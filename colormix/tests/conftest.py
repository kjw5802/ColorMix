import os
import sys

# tests/ 안에서도 app.py, storage.py, pdfmaker.py를 import할 수 있게 한다
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
