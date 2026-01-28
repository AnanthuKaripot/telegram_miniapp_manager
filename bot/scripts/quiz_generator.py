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
import json
import random
from datetime import datetime


def generate_quiz(qbank_path: str, output_path: str, num_questions: int = 10) -> None:
    """
    Generate a quiz from random questions in the QBank.
    
    Args:
        qbank_path: Path to directory containing subject JSON files
        output_path: Path where quiz_data.json will be written
        num_questions: Number of questions to include (default: 10)
    
    Returns:
        None. Writes output to output_path.
    """
    try:
        # Get all subject files
        subject_files = [f for f in os.listdir(qbank_path) if f.endswith('.json')]
        if not subject_files:
            print("No subject files found.")
            return

        # Pick a random subject
        subject_file = random.choice(subject_files)
        subject_name = subject_file.replace('.json', '')
        print(f"Selecting questions from: {subject_name}")

        file_path = os.path.join(qbank_path, subject_file)
        
        # Read questions (JSON Lines format)
        questions = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    questions.append(json.loads(line))

        if len(questions) < num_questions:
            selected = questions
        else:
            selected = random.sample(questions, num_questions)

        # Generate unique quiz ID
        quiz_id = f"quiz_{datetime.now().strftime('%Y_%m_%d')}_{subject_name.lower().replace(' ', '_')}"

        # Output structure
        quiz_data = {
            "quiz_id": quiz_id,
            "subject": subject_name,
            "questions": selected
        }

        # Write to output
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(quiz_data, f, indent=2)
        
        print(f"Successfully generated quiz with {len(selected)} questions to {output_path}")

    except Exception as e:
        print(f"Error generating quiz: {e}")

if __name__ == "__main__":
    # Update paths as needed for your environment
    QBANK_DIR = r"c:\flutter_project\neet_pg_tools_flutter\neetpg_app\assets\qbank"
    
    # n8n local files directory
    OUTPUT_DIR = r"C:\Users\anant\.n8n-files\quiz"
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    OUTPUT_FILE = os.path.join(OUTPUT_DIR, "quiz_data.json")
    
    generate_quiz(QBANK_DIR, OUTPUT_FILE)
