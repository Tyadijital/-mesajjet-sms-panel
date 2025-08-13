import sys
import os

# Ensure the app package is on the path
sys.path.insert(0, os.path.dirname(__file__))

from app.main import app as application  # cPanel Passenger expects 'application'