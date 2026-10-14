import os
import re
from typing import List, Dict, Any
from app.ingestion.pdf_processor import DocumentProcessingError, is_readable_content

class VideoProcessor:
    @staticmethod
    def extract_chunks(file_path: str, course_id: str, material_id: str, source_name: str) -> List[Dict[str, Any]]:
        chunks = []
        # Video transcription simulation / Whisper engine adapter
        # In full production this hooks to openai-whisper or faster-whisper.
        # For fast local execution and robust fallback, we extract timestamped chunks.
        
        # Check if sidecar .vtt / .srt or transcript exists
        transcript_path = os.path.splitext(file_path)[0] + ".vtt"
        if os.path.exists(transcript_path):
            try:
                with open(transcript_path, "r", encoding="utf-8-sig") as transcript:
                    blocks = re.split(r"\r?\n\s*\r?\n", transcript.read())
                cues = []
                for block in blocks:
                    lines = [line.strip() for line in block.splitlines() if line.strip()]
                    timestamp_line = next((line for line in lines if "-->" in line), None)
                    if not timestamp_line:
                        continue
                    timestamp = timestamp_line.split("-->", 1)[0].strip().split(".")[0]
                    cue_text = " ".join(
                        line for line in lines
                        if "-->" not in line and not line.isdigit()
                    )
                    if cue_text and is_readable_content(cue_text):
                        cues.append((timestamp, cue_text))

                grouped_text = []
                group_start = None
                for timestamp, cue_text in cues:
                    group_start = group_start or timestamp
                    grouped_text.append(cue_text)
                    if sum(len(part) for part in grouped_text) >= 400:
                        content = " ".join(grouped_text)
                        chunks.append({
                            "course_id": course_id,
                            "material_id": material_id,
                            "material_type": "video",
                            "source_name": source_name,
                            "page_number": None,
                            "slide_number": None,
                            "video_timestamp": group_start,
                            "topic": "Lecture Transcript",
                            "concept": None,
                            "content": content,
                        })
                        grouped_text = []
                        group_start = None
                if grouped_text:
                    chunks.append({
                        "course_id": course_id,
                        "material_id": material_id,
                        "material_type": "video",
                        "source_name": source_name,
                        "page_number": None,
                        "slide_number": None,
                        "video_timestamp": group_start,
                        "topic": "Lecture Transcript",
                        "concept": None,
                        "content": " ".join(grouped_text),
                    })
            except Exception as exc:
                raise DocumentProcessingError("The available video transcript could not be read.") from exc
                
        if not chunks:
            raise DocumentProcessingError(
                "No transcript was found for this recording. Video/audio transcription is not configured; "
                "provide a matching .vtt transcript and retry."
            )

        chunks = [chunk for chunk in chunks if is_readable_content(chunk["content"])]
        if not chunks:
            raise DocumentProcessingError("The transcript contains no readable study text.")
                
        return chunks
