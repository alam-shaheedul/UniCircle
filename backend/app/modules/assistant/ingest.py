r"""Curated CUET knowledge ingestion, with an explicit optional web crawler.

Run from backend/ after applying migrations:
    .\.venv\Scripts\python -m app.modules.assistant.ingest
"""

import argparse
import hashlib
import logging
import re
import tempfile
import time
from collections import deque
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from urllib import robotparser
from urllib.parse import urlsplit

import requests
from bs4 import BeautifulSoup
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.models import RagChunk, RagSource
from app.db.session import get_session_factory
from app.modules.assistant.curated import (
    KNOWLEDGE_FILE,
    ingest_curated,
    load_knowledge,
    plain_text,
)
from app.modules.assistant.embeddings import create_embedding_provider
from app.modules.assistant.policy import SourcePolicy

logger = logging.getLogger(__name__)
USER_AGENT = "UniCircleKnowledgeBot/1.0 (+CUET student project; respectful crawler)"
MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024
MAX_TEXT_CHARACTERS = 2_000_000


@dataclass
class CrawlResult:
    discovered: int = 0
    processed: int = 0
    updated: int = 0
    unchanged: int = 0
    failed: int = 0
    chunks: int = 0


@dataclass(frozen=True)
class LoadedPage:
    url: str
    title: str
    content_type: str
    text: str
    links: tuple[str, ...]
    published_at: datetime | None


def clean_text(value: str) -> str:
    value = value.replace("\u00a0", " ")
    lines = [re.sub(r"\s+", " ", line).strip() for line in value.splitlines()]
    cleaned: list[str] = []
    for line in lines:
        if not line or (cleaned and cleaned[-1] == line):
            continue
        cleaned.append(line)
    return "\n".join(cleaned)[:MAX_TEXT_CHARACTERS]


def parse_page_date(soup: BeautifulSoup) -> datetime | None:
    selectors = (
        ("meta", {"property": "article:published_time"}, "content"),
        ("meta", {"name": "date"}, "content"),
        ("time", {}, "datetime"),
    )
    for tag, attrs, attribute in selectors:
        node = soup.find(tag, attrs=attrs)
        raw = node.get(attribute) if node else None
        if not isinstance(raw, str) or not raw.strip():
            continue
        try:
            parsed = datetime.fromisoformat(raw.strip().replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
        except ValueError:
            continue
    return None


class CuetKnowledgeIngestor:
    def __init__(
        self,
        db: Session,
        settings: Settings,
        *,
        max_pages: int | None = None,
        max_depth: int | None = None,
        force: bool = False,
    ) -> None:
        self.db = db
        self.settings = settings
        self.policy = SourcePolicy(settings.rag_hosts)
        self.max_pages = min(max_pages or settings.rag_max_pages, 5000)
        self.max_depth = max_depth if max_depth is not None else settings.rag_max_depth
        self.force = force
        self.http = requests.Session()
        self.http.headers.update(
            {"User-Agent": USER_AGENT, "Accept": "text/html,application/pdf"}
        )
        self.robots: dict[str, robotparser.RobotFileParser | None] = {}
        self.embedder = create_embedding_provider(settings)
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.rag_chunk_size,
            chunk_overlap=settings.rag_chunk_overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

    def _robots_allowed(self, url: str) -> bool:
        host = urlsplit(url).hostname or ""
        if host not in self.robots:
            robots_url = f"https://{host}/robots.txt"
            try:
                response = self.http.get(
                    robots_url, timeout=self.settings.rag_request_timeout_seconds
                )
                if response.status_code == 200:
                    parser = robotparser.RobotFileParser()
                    parser.set_url(robots_url)
                    parser.parse(response.text.splitlines())
                    self.robots[host] = parser
                else:
                    self.robots[host] = None
            except requests.RequestException:
                logger.warning(
                    "Could not retrieve %s; continuing at the configured rate",
                    robots_url,
                )
                self.robots[host] = None
        parser = self.robots[host]
        return parser is None or parser.can_fetch(USER_AGENT, url)

    def _get(self, url: str) -> requests.Response:
        response = self.http.get(
            url,
            timeout=self.settings.rag_request_timeout_seconds,
            allow_redirects=True,
            stream=True,
        )
        response.raise_for_status()
        final_url = self.policy.canonicalize(response.url)
        if final_url is None:
            raise ValueError("Redirect left the approved CUET source allowlist")
        length = int(response.headers.get("content-length", "0") or 0)
        if length > MAX_DOWNLOAD_BYTES:
            raise ValueError("Document exceeds the ingestion size limit")
        return response

    def _load_pdf(self, url: str, response: requests.Response) -> LoadedPage:
        from langchain_community.document_loaders import PyPDFLoader

        content = response.content
        if len(content) > MAX_DOWNLOAD_BYTES:
            raise ValueError("PDF exceeds the ingestion size limit")
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as handle:
            handle.write(content)
            temp_path = Path(handle.name)
        try:
            documents = PyPDFLoader(str(temp_path)).load()
        finally:
            temp_path.unlink(missing_ok=True)
        title = Path(urlsplit(url).path).stem.replace("-", " ").replace("_", " ")
        text = clean_text("\n\n".join(document.page_content for document in documents))
        return LoadedPage(
            url, title or "CUET document", "application/pdf", text, (), None
        )

    def _load_html(self, url: str, response: requests.Response) -> LoadedPage:
        from langchain_community.document_loaders import WebBaseLoader

        raw = response.content
        if len(raw) > MAX_DOWNLOAD_BYTES:
            raise ValueError("HTML document exceeds the ingestion size limit")
        soup = BeautifulSoup(raw, "html.parser")
        links = tuple(
            canonical
            for node in soup.select("a[href]")
            if (
                canonical := self.policy.canonicalize(
                    str(node.get("href")), base_url=url
                )
            )
        )
        title_node = soup.find("meta", attrs={"property": "og:title"})
        title = (
            str(title_node.get("content", "")).strip()
            if title_node
            else (soup.title.get_text(" ", strip=True) if soup.title else url)
        )
        loader = WebBaseLoader(
            web_paths=(url,),
            header_template={"User-Agent": USER_AGENT},
            requests_kwargs={"timeout": self.settings.rag_request_timeout_seconds},
            continue_on_failure=False,
        )
        documents = loader.load()
        text = clean_text("\n\n".join(document.page_content for document in documents))
        return LoadedPage(
            url=url,
            title=title[:500] or "CUET information",
            content_type="text/html",
            text=text,
            links=links,
            published_at=parse_page_date(soup),
        )

    def _load(self, url: str) -> LoadedPage:
        response = self._get(url)
        resolved_url = self.policy.canonicalize(response.url)
        if resolved_url is None:
            raise ValueError("Resolved URL is not approved")
        content_type = response.headers.get("content-type", "").lower()
        if self.policy.is_pdf(resolved_url) or "application/pdf" in content_type:
            return self._load_pdf(resolved_url, response)
        if (
            "text/html" not in content_type
            and "application/xhtml+xml" not in content_type
        ):
            raise ValueError(f"Unsupported content type: {content_type or 'unknown'}")
        return self._load_html(resolved_url, response)

    def _save_failure(self, url: str, exc: Exception) -> None:
        source = self.db.scalar(select(RagSource).where(RagSource.url == url))
        now = datetime.now(UTC)
        if source is None:
            source = RagSource(
                url=url,
                title=url,
                content_type="unknown",
                status="failed",
                crawled_at=now,
                error_message=str(exc)[:500],
                source_metadata={"host": urlsplit(url).hostname},
            )
            self.db.add(source)
        else:
            # A temporary refresh failure must not discard previously usable chunks.
            source.status = "active" if source.chunks else "failed"
            source.crawled_at = now
            source.error_message = str(exc)[:500]
        self.db.commit()

    def _save_page(self, page: LoadedPage) -> tuple[str, int]:
        if len(page.text) < 80:
            raise ValueError("Page did not contain enough useful text")
        digest = hashlib.sha256(page.text.encode()).hexdigest()
        source = self.db.scalar(select(RagSource).where(RagSource.url == page.url))
        now = datetime.now(UTC)
        if source and source.content_hash == digest and not self.force:
            source.status = "unchanged"
            source.crawled_at = now
            source.error_message = None
            self.db.commit()
            return "unchanged", 0

        chunks = [
            chunk.strip()
            for chunk in self.splitter.split_text(page.text)
            if chunk.strip()
        ]
        if not chunks:
            raise ValueError("Text splitter produced no knowledge chunks")
        vectors = self.embedder.embed_documents(chunks)
        if len(vectors) != len(chunks):
            raise RuntimeError("Embedding provider returned an unexpected result")
        if source is None:
            source = RagSource(
                url=page.url,
                title=page.title,
                content_type=page.content_type,
                status="active",
                crawled_at=now,
                source_metadata={},
            )
            self.db.add(source)
            self.db.flush()
        else:
            self.db.execute(delete(RagChunk).where(RagChunk.source_id == source.id))
        source.title = page.title
        source.content_type = page.content_type
        source.content_hash = digest
        source.status = "active"
        source.published_at = page.published_at
        source.crawled_at = now
        source.error_message = None
        source.source_metadata = {
            "host": urlsplit(page.url).hostname,
            "loader": "PyPDFLoader"
            if page.content_type == "application/pdf"
            else "WebBaseLoader",
            "embeddingModel": self.settings.assistant_embedding_model,
        }
        self.db.add_all(
            [
                RagChunk(
                    source_id=source.id,
                    chunk_index=index,
                    content=content,
                    content_hash=hashlib.sha256(content.encode()).hexdigest(),
                    embedding=vector,
                )
                for index, (content, vector) in enumerate(
                    zip(chunks, vectors, strict=True)
                )
            ]
        )
        self.db.commit()
        return "updated", len(chunks)

    def crawl(self, seeds: tuple[str, ...]) -> CrawlResult:
        queue: deque[tuple[str, int]] = deque()
        queued: set[str] = set()
        for seed in seeds:
            canonical = self.policy.canonicalize(seed)
            if canonical is None:
                raise ValueError(f"Seed URL is not approved: {seed}")
            queue.append((canonical, 0))
            queued.add(canonical)

        result = CrawlResult(discovered=len(queue))
        visited: set[str] = set()
        delay = 1 / self.settings.rag_requests_per_second
        while queue and result.processed < self.max_pages:
            url, depth = queue.popleft()
            if url in visited:
                continue
            visited.add(url)
            if not self._robots_allowed(url):
                logger.info("robots.txt disallows %s", url)
                continue
            try:
                page = self._load(url)
                result.processed += 1
                if depth < self.max_depth:
                    for link in page.links:
                        if link not in queued and len(queued) < self.max_pages * 5:
                            queue.append((link, depth + 1))
                            queued.add(link)
                    result.discovered = len(queued)
                outcome, chunk_count = self._save_page(page)
                result.chunks += chunk_count
                if outcome == "updated":
                    result.updated += 1
                else:
                    result.unchanged += 1
                logger.info("%s %s (%s chunks)", outcome, url, chunk_count)
            except Exception as exc:
                self.db.rollback()
                self._save_failure(url, exc)
                result.processed += 1
                result.failed += 1
                logger.warning("Failed to ingest %s: %s", url, exc)
            time.sleep(delay)
        return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest reviewed local CUET knowledge")
    parser.add_argument(
        "--web", action="store_true", help="Explicitly use legacy crawler"
    )
    parser.add_argument(
        "--check", action="store_true", help="Validate local files only"
    )
    parser.add_argument(
        "--export-txt", action="store_true", help="Refresh TXT mirror without indexing"
    )
    parser.add_argument("--seed", action="append", help="Approved seed URL; repeatable")
    parser.add_argument("--max-pages", type=int)
    parser.add_argument("--max-depth", type=int)
    parser.add_argument("--force", action="store_true", help="Re-embed unchanged pages")
    return parser.parse_args()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = parse_args()
    if args.export_txt:
        KNOWLEDGE_FILE.with_suffix(".txt").write_text(
            plain_text(KNOWLEDGE_FILE.read_text(encoding="utf-8")),
            encoding="utf-8",
        )
        load_knowledge()
        print("CUET TXT companion refreshed; run ingestion to update the index")
        return
    if args.check:
        snapshot = load_knowledge()
        print(f"CUET knowledge files valid: {len(snapshot.sections)} reviewed sections")
        return
    settings = get_settings()
    if not args.web:
        if args.seed or args.max_pages or args.max_depth is not None:
            raise SystemExit(
                "Crawler options require --web; default ingestion uses local files"
            )
        with get_session_factory()() as db:
            result = ingest_curated(db, settings, force=args.force)
        print(
            "Curated RAG ingestion complete: "
            + ", ".join(f"{key}={value}" for key, value in result.items())
        )
        return
    seeds = tuple(args.seed) if args.seed else settings.rag_seeds
    if not seeds:
        raise SystemExit("No RAG seed URLs are configured")
    with get_session_factory()() as db:
        result = CuetKnowledgeIngestor(
            db,
            settings,
            max_pages=args.max_pages,
            max_depth=args.max_depth,
            force=args.force,
        ).crawl(seeds)
    print(
        "RAG ingestion complete: "
        f"processed={result.processed}, updated={result.updated}, "
        f"unchanged={result.unchanged}, failed={result.failed}, chunks={result.chunks}"
    )
    if result.failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
