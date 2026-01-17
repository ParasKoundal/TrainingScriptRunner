import argparse

def main():
    parser = argparse.ArgumentParser(description="A script with 15 mixed-type arguments.")

    # --- REQUIRED ARGUMENTS (2) ---
    parser.add_argument("--input", type=str, required=True, help="Path to input file")
    parser.add_argument("--output", type=str, required=True, help="Path to output file")

    # --- OPTIONAL ARGUMENTS WITH DEFAULTS & MIXED TYPES (13) ---
    # Strings
    parser.add_argument("--username", type=str, default="admin", help="System username")
    parser.add_argument("--mode", type=str, choices=['fast', 'slow', 'safe'], default="fast", help="Operational mode")
    parser.add_argument("--log-level", type=str, default="INFO", help="Logging threshold")

    # Integers
    parser.add_argument("--count", type=int, default=1, help="Number of repetitions")
    parser.add_argument("--port", type=int, default=8080, help="Network port number")
    parser.add_argument("--retries", type=int, default=3, help="Number of retry attempts")
    parser.add_argument("--threads", type=int, default=4, help="Number of CPU threads")

    # Floats
    parser.add_argument("--threshold", type=float, default=0.5, help="Activation threshold")
    parser.add_argument("--learning-rate", type=float, default=0.001, help="AI training rate")
    parser.add_argument("--timeout", type=float, default=30.0, help="Connection timeout in seconds")

    # Booleans (Flags)
    parser.add_argument("--verbose", action="store_true", help="Enable verbose output")
    parser.add_argument("--dry-run", action="store_true", help="Simulate execution without changes")
    parser.add_argument("--secure", action="store_false", help="Disable secure mode (defaults to True if not called)")

    # Parse the arguments
    args = parser.parse_args()

    # The script's logic
    print("hi")

if __name__ == "__main__":
    main()
