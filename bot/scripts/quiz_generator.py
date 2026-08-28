"""
Quiz Generator Script for PG PathScheduler

Generates weekly quiz data by selecting random questions from the QBank.
Used by n8n automation to update quiz_data.json in the GitHub repository.

Usage:
    python quiz_generator.py

Output:
    Creates quiz_data.json with structure:
    {
        "quiz_id": "quiz_YYYY_MM_DD_subject",
        "subject": "Subject Name",
        "questions": [...]
    }
"""

import os
import sys
import json
import random
from datetime import datetime


def format_explanation(q: dict) -> str:
    """Build markdown explanation for the mini app from QBank exp_* fields."""
    parts = []
    if q.get("exp_concept"):
        parts.append(f"**Concept:** {q['exp_concept']}")
    if q.get("exp_reasoning"):
        parts.append(f"**Reasoning:** {q['exp_reasoning']}")
    if q.get("exp_distractors"):
        parts.append(f"**Why wrong:** {q['exp_distractors']}")
    if q.get("exp_key_takeaway"):
        parts.append(f"**Key Takeaway:** {q['exp_key_takeaway']}")
    return "\n\n".join(parts)


def transform_question(q: dict) -> dict:
    """Map QBank JSONL row to the shape expected by pathscheduler/quiz/index.html."""
    return {
        "id": q.get("uuid") or str(q.get("id", "")),
        "question": q.get("question", ""),
        "opa": q.get("opa", ""),
        "opb": q.get("opb", ""),
        "opc": q.get("opc", ""),
        "opd": q.get("opd", ""),
        "cop": q.get("cop", 1),
        "explanation": format_explanation(q),
        "ai_search_tags": q.get("ai_search_tags"),
        "subject_name": q.get("subject_name"),
        "topic_name": q.get("topic_name"),
        "difficulty": q.get("difficulty"),
        "is_clinical": bool(q.get("is_clinical")),
        "pyq_source": q.get("pyq_source"),
    }


def generate_quiz(qbank_path: str, output_path: str, num_questions: int = 10) -> bool:
    """
    Generate a quiz from random questions in the QBank.

    Returns True on success, False on failure.
    """
    try:
        if not os.path.isdir(qbank_path):
            print(f"QBank directory not found: {qbank_path}")
            return False

        subject_files = [f for f in os.listdir(qbank_path) if f.endswith(".json")]
        if not subject_files:
            print("No subject files found.")
            return False

        subject_file = random.choice(subject_files)
        file_path = os.path.join(qbank_path, subject_file)
        print(f"Selecting questions from: {subject_file}")

        questions = []
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    questions.append(json.loads(line))

        if not questions:
            print(f"No questions in {subject_file}")
            return False

        subject_name = questions[0].get("subject_name") or subject_file.replace(
            ".json", ""
        ).replace("_", " ").title()

        if len(questions) < num_questions:
            selected = questions
        else:
            selected = random.sample(questions, num_questions)

        quiz_id = (
            f"quiz_{datetime.now().strftime('%Y_%m_%d')}_"
            f"{subject_name.lower().replace(' ', '_')}"
        )

        quiz_data = {
            "quiz_id": quiz_id,
            "subject": subject_name,
            "questions": [transform_question(q) for q in selected],
        }

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(quiz_data, f, indent=2)

        print(
            f"Successfully generated quiz with {len(selected)} questions to {output_path}"
        )
        return True

    except Exception as e:
        print(f"Error generating quiz: {e}")
        return False


if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.normpath(os.path.join(script_dir, "..", ".."))

    default_qbank_dir = os.path.normpath(
        os.path.join(repo_root, "..", "PG-PathScheduler", "assets", "web", "qbank")
    )
    if not os.path.isdir(default_qbank_dir):
        default_qbank_dir = os.path.join(repo_root, "assets", "web", "qbank")

    QBANK_DIR = os.environ.get("QBANK_DIR", default_qbank_dir)
    OUTPUT_DIR = os.environ.get(
        "QUIZ_OUTPUT_DIR",
        os.path.join(
            os.path.expanduser("~"), ".n8n-files", "quiz"
        ),
    )
    OUTPUT_FILE = os.path.join(OUTPUT_DIR, "quiz_data.json")

    ok = generate_quiz(QBANK_DIR, OUTPUT_FILE)
    sys.exit(0 if ok else 1)
