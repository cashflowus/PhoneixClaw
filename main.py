"""
Main entry point for the trading bot.

Run message parser service:
    python main.py parser

Run execution service:
    python main.py execution

Run both (in separate processes):
    python main.py parser &
    python main.py execution
"""
import sys
import asyncio
from connectors.discord_connector import run
from services.execution_service import execution_service
from db.db_util import init_db

if __name__ == "__main__":
    if len(sys.argv) > 1:
        service = sys.argv[1].lower()
        if service == "parser":
            run()
        elif service == "execution":
            asyncio.run(execution_service.run_loop())
        else:
            print("Usage: python main.py [parser|execution]")
            sys.exit(1)
    else:
        # Default: run message parser
        print("Starting Message Parser Service (Discord)")
        print("To run execution service: python main.py execution")
        run()
