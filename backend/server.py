from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.middleware.cors import CORSMiddleware
import os
import logging
import bcrypt
import jwt
import uuid
import re
import asyncio
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from bson import ObjectId
from openai import AsyncOpenAI

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

openai_client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

app = FastAPI()

origins = [
    "https://interprep-puce.vercel.app",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

# JWT config
JWT_ALGORITHM = "HS256"

def get_jwt_secret():
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# --- Models ---
class LoginRequest(BaseModel):
    email: str
    password: str

class DomainCreate(BaseModel):
    name: str
    description: str = ""

class DomainUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class QuestionCreate(BaseModel):
    domain_id: str
    question: str
    answer: str
    difficulty: str = "medium"
    is_most_asked: bool = False
    tags: List[str] = []

class QuestionUpdate(BaseModel):
    domain_id: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    difficulty: Optional[str] = None
    is_most_asked: Optional[bool] = None
    tags: Optional[List[str]] = None

class ChatRequest(BaseModel):
    question_context: str
    answer_context: str
    user_message: str
    session_id: Optional[str] = None

# --- Auth Routes ---
@api_router.post("/auth/login")
async def login(req: LoginRequest, response: Response):
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return {"id": user_id, "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "user"), "token": access_token}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return {"id": user["_id"], "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "user")}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

# --- Domain Routes ---
def slugify(text):
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text

@api_router.get("/domains")
async def get_domains():
    domains = await db.domains.find({}, {"_id": 0}).to_list(100)
    # Single aggregation query for all counts
    pipeline = [{"$group": {"_id": "$domain_id", "count": {"$sum": 1}}}]
    counts = {item["_id"]: item["count"] for item in await db.questions.aggregate(pipeline).to_list(100)}
    for d in domains:
        d["question_count"] = counts.get(d["id"], 0)
    return domains

@api_router.get("/domains/{slug}")
async def get_domain(slug: str):
    domain = await db.domains.find_one({"slug": slug}, {"_id": 0})
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    return domain

@api_router.post("/admin/domains")
async def create_domain(req: DomainCreate, request: Request):
    await get_current_user(request)
    slug = slugify(req.name)
    existing = await db.domains.find_one({"slug": slug})
    if existing:
        raise HTTPException(status_code=400, detail="Domain already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "name": req.name,
        "description": req.description,
        "slug": slug,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.domains.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/admin/domains/{domain_id}")
async def update_domain(domain_id: str, req: DomainUpdate, request: Request):
    await get_current_user(request)
    update_data = {k: v for k, v in req.model_dump().items() if v is not None}
    if "name" in update_data:
        update_data["slug"] = slugify(update_data["name"])
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.domains.update_one({"id": domain_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Domain not found")
    updated = await db.domains.find_one({"id": domain_id}, {"_id": 0})
    return updated

@api_router.delete("/admin/domains/{domain_id}")
async def delete_domain(domain_id: str, request: Request):
    await get_current_user(request)
    result = await db.domains.delete_one({"id": domain_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Domain not found")
    await db.questions.delete_many({"domain_id": domain_id})
    return {"message": "Domain deleted"}

# --- Question Routes ---
@api_router.get("/questions")
async def get_questions(domain_id: Optional[str] = None, difficulty: Optional[str] = None, most_asked: Optional[bool] = None):
    query = {}
    if domain_id:
        query["domain_id"] = domain_id
    if difficulty and difficulty != "all":
        query["difficulty"] = difficulty
    if most_asked:
        query["is_most_asked"] = True
    questions = await db.questions.find(query, {"_id": 0}).to_list(500)
    return questions

@api_router.get("/questions/{question_id}")
async def get_question(question_id: str):
    q = await db.questions.find_one({"id": question_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return q

@api_router.post("/admin/questions")
async def create_question(req: QuestionCreate, request: Request):
    await get_current_user(request)
    doc = {
        "id": str(uuid.uuid4()),
        "domain_id": req.domain_id,
        "question": req.question,
        "answer": req.answer,
        "difficulty": req.difficulty,
        "is_most_asked": req.is_most_asked,
        "tags": req.tags,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.questions.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/admin/questions/{question_id}")
async def update_question(question_id: str, req: QuestionUpdate, request: Request):
    await get_current_user(request)
    update_data = {k: v for k, v in req.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.questions.update_one({"id": question_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    updated = await db.questions.find_one({"id": question_id}, {"_id": 0})
    return updated

@api_router.delete("/admin/questions/{question_id}")
async def delete_question(question_id: str, request: Request):
    await get_current_user(request)
    result = await db.questions.delete_one({"id": question_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"message": "Question deleted"}

# --- AI Chat Route (Native OpenAI Migration) ---
@api_router.post("/chat")
async def chat_endpoint(req: ChatRequest):
    session_id = req.session_id or str(uuid.uuid4())
    system_message = f"""You are a Technical Interview Coach. Your role is to help users understand interview questions deeply.

CONTEXT - The user is studying this interview question:
Question: {req.question_context}
Answer: {req.answer_context}

RULES:
1. Only answer questions related to this interview topic, programming, or technical interview preparation.
2. If the user asks something unrelated (recipes, weather, personal advice, etc.), politely redirect them: "I'm your interview coach! Let's focus on mastering this topic. What would you like to understand better about this question?"
3. Provide clear, concise explanations with code examples when helpful.
4. Use markdown formatting for readability.
5. Be encouraging and supportive."""

    # 1. Fetch historical message logs from MongoDB
    chat_doc = await db.chat_history.find_one({"session_id": session_id}, {"_id": 0})
    history_messages = []
    if chat_doc and chat_doc.get("messages"):
        # Take the last 10 messages to keep within payload/context limits
        history_messages = chat_doc["messages"][-10:]

    # 2. Reconstruct payload structure matching standard OpenAI roles API
    openai_messages = [{"role": "system", "content": system_message}]
    
    # Append loaded conversation timeline logs
    for msg in history_messages:
        openai_messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })
        
    # Append the new message the user just typed
    openai_messages.append({"role": "user", "content": req.user_message})

    try:
        # 3. Call OpenAI using your initialized async instance 
        response = await openai_client.chat.completions.create(
            model="gpt-4o",  # Standard choice for advanced engineering coaching
            messages=openai_messages,
            temperature=0.7
        )
        
        response_text = response.choices[0].message.content

        # 4. Save entire execution trace back down to MongoDB
        new_messages = history_messages + [
            {"role": "user", "content": req.user_message},
            {"role": "assistant", "content": response_text}
        ]
        
        await db.chat_history.update_one(
            {"session_id": session_id},
            {
                "$set": {
                    "session_id": session_id, 
                    "messages": new_messages, 
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )

        return {"response": response_text, "session_id": session_id}
        
    except Exception as e:
        logger.error(f"Native AI Chat Error: {e}")
        raise HTTPException(status_code=500, detail="AI service temporarily unavailable. Please try again.")

# --- Admin Analytics ---
@api_router.get("/admin/analytics")
async def get_analytics(request: Request):
    await get_current_user(request)
    total_domains = await db.domains.count_documents({})
    total_questions = await db.questions.count_documents({})
    total_chats = await db.chat_history.count_documents({})
    difficulty_pipeline = [
        {"$group": {"_id": "$difficulty", "count": {"$sum": 1}}}
    ]
    difficulty_stats = await db.questions.aggregate(difficulty_pipeline).to_list(10)
    diff_map = {item["_id"]: item["count"] for item in difficulty_stats}
    return {
        "total_domains": total_domains,
        "total_questions": total_questions,
        "total_chat_sessions": total_chats,
        "difficulty_breakdown": diff_map
    }

# --- Search ---
@api_router.get("/search")
async def search(q: str = ""):
    if not q or len(q) < 2:
        return {"domains": [], "questions": []}
    regex = {"$regex": q, "$options": "i"}
    domains = await db.domains.find({"$or": [{"name": regex}, {"description": regex}]}, {"_id": 0}).to_list(10)
    questions = await db.questions.find({"$or": [{"question": regex}, {"tags": regex}]}, {"_id": 0}).to_list(20)
    return {"domains": domains, "questions": questions}

# --- Question of the Day ---
@api_router.get("/question-of-the-day")
async def question_of_the_day():
    import hashlib
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    all_questions = await db.questions.find({"is_most_asked": True}, {"_id": 0}).to_list(500)
    if not all_questions:
        all_questions = await db.questions.find({}, {"_id": 0}).to_list(500)
    if not all_questions:
        return None
    seed = int(hashlib.md5(today.encode()).hexdigest(), 16)
    idx = seed % len(all_questions)
    question = all_questions[idx]
    domain = await db.domains.find_one({"id": question["domain_id"]}, {"_id": 0})
    return {"question": question, "domain": domain}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Seed Data ---
SEED_DOMAINS = [
    {"id": "d-javascript", "name": "JavaScript", "description": "Core JavaScript concepts, ES6+, closures, promises, and more", "slug": "javascript"},
    {"id": "d-react", "name": "React", "description": "React hooks, state management, component lifecycle, and patterns", "slug": "react"},
    {"id": "d-nodejs", "name": "Node.js", "description": "Server-side JavaScript, Express, streams, and async patterns", "slug": "nodejs"},
    {"id": "d-dsa", "name": "Data Structures & Algorithms", "description": "Arrays, trees, graphs, sorting, searching, and dynamic programming", "slug": "data-structures-algorithms"},
    {"id": "d-python", "name": "Python", "description": "Python fundamentals, OOP, decorators, generators, and best practices", "slug": "python"},
    {"id": "d-system-design", "name": "System Design", "description": "Scalability, load balancing, caching, database design, and architecture", "slug": "system-design"},
]

SEED_QUESTIONS = [
    # JavaScript
    {"id": "q-js-1", "domain_id": "d-javascript", "question": "What is a closure in JavaScript?", "answer": "A **closure** is a function that has access to variables from its outer (enclosing) function's scope, even after the outer function has returned.\n\n```javascript\nfunction outer() {\n  let count = 0;\n  return function inner() {\n    count++;\n    return count;\n  };\n}\n\nconst counter = outer();\nconsole.log(counter()); // 1\nconsole.log(counter()); // 2\n```\n\n**Key points:**\n- Closures \"remember\" the environment in which they were created\n- They are commonly used for data privacy and factory functions\n- Every function in JavaScript creates a closure", "difficulty": "medium", "is_most_asked": True, "tags": ["closures", "scope", "functions"]},
    {"id": "q-js-2", "domain_id": "d-javascript", "question": "Explain the difference between var, let, and const", "answer": "## `var` vs `let` vs `const`\n\n| Feature | `var` | `let` | `const` |\n|---------|-------|-------|---------|\n| Scope | Function | Block | Block |\n| Hoisting | Yes (undefined) | Yes (TDZ) | Yes (TDZ) |\n| Re-declaration | Allowed | Not allowed | Not allowed |\n| Re-assignment | Allowed | Allowed | Not allowed |\n\n```javascript\n// var - function scoped\nfunction example() {\n  if (true) {\n    var x = 10;\n  }\n  console.log(x); // 10 - accessible!\n}\n\n// let - block scoped\nfunction example2() {\n  if (true) {\n    let y = 10;\n  }\n  // console.log(y); // ReferenceError\n}\n\n// const - block scoped, immutable binding\nconst obj = { name: 'John' };\nobj.name = 'Jane'; // OK - mutating property\n// obj = {}; // TypeError - can't reassign\n```\n\n**Best practice:** Use `const` by default, `let` when reassignment is needed, avoid `var`.", "difficulty": "easy", "is_most_asked": True, "tags": ["variables", "scope", "hoisting"]},
    {"id": "q-js-3", "domain_id": "d-javascript", "question": "What is the event loop in JavaScript?", "answer": "The **event loop** is the mechanism that allows JavaScript to perform non-blocking operations despite being single-threaded.\n\n## How it works:\n\n1. **Call Stack** - Executes synchronous code\n2. **Web APIs** - Handles async operations (setTimeout, fetch, DOM events)\n3. **Callback Queue** (Task Queue) - Holds callbacks ready to execute\n4. **Microtask Queue** - Holds Promise callbacks (higher priority)\n\n```javascript\nconsole.log('1'); // Sync - Call Stack\n\nsetTimeout(() => {\n  console.log('2'); // Macro task\n}, 0);\n\nPromise.resolve().then(() => {\n  console.log('3'); // Micro task\n});\n\nconsole.log('4'); // Sync - Call Stack\n\n// Output: 1, 4, 3, 2\n```\n\n**Key insight:** Microtasks (Promises) always execute before macrotasks (setTimeout, setInterval).", "difficulty": "hard", "is_most_asked": True, "tags": ["event-loop", "async", "concurrency"]},
    {"id": "q-js-4", "domain_id": "d-javascript", "question": "What are Promises and how do they work?", "answer": "A **Promise** is an object representing the eventual completion or failure of an asynchronous operation.\n\n## States:\n- **Pending** - Initial state\n- **Fulfilled** - Operation completed successfully\n- **Rejected** - Operation failed\n\n```javascript\nconst myPromise = new Promise((resolve, reject) => {\n  const success = true;\n  if (success) {\n    resolve('Data loaded!');\n  } else {\n    reject('Error occurred');\n  }\n});\n\nmyPromise\n  .then(data => console.log(data))\n  .catch(err => console.error(err))\n  .finally(() => console.log('Done'));\n```\n\n## Async/Await (syntactic sugar):\n```javascript\nasync function fetchData() {\n  try {\n    const response = await fetch('/api/data');\n    const data = await response.json();\n    return data;\n  } catch (error) {\n    console.error('Failed:', error);\n  }\n}\n```", "difficulty": "medium", "is_most_asked": True, "tags": ["promises", "async", "await"]},
    # React
    {"id": "q-react-1", "domain_id": "d-react", "question": "What are React Hooks and why were they introduced?", "answer": "**React Hooks** are functions that let you use state and other React features in functional components.\n\n## Why Hooks?\n- Reuse stateful logic between components\n- Split complex components into smaller functions\n- Use state without writing classes\n\n## Common Hooks:\n\n```jsx\nimport { useState, useEffect, useCallback, useMemo } from 'react';\n\nfunction Counter() {\n  // useState - manages local state\n  const [count, setCount] = useState(0);\n\n  // useEffect - side effects\n  useEffect(() => {\n    document.title = `Count: ${count}`;\n    return () => { /* cleanup */ };\n  }, [count]);\n\n  // useCallback - memoized callback\n  const increment = useCallback(() => {\n    setCount(prev => prev + 1);\n  }, []);\n\n  return <button onClick={increment}>{count}</button>;\n}\n```\n\n## Rules of Hooks:\n1. Only call at the top level (not inside loops/conditions)\n2. Only call from React functions", "difficulty": "medium", "is_most_asked": True, "tags": ["hooks", "useState", "useEffect"]},
    {"id": "q-react-2", "domain_id": "d-react", "question": "Explain the Virtual DOM and reconciliation", "answer": "The **Virtual DOM** is a lightweight JavaScript representation of the actual DOM.\n\n## How it works:\n\n1. **Render** - React creates a virtual DOM tree\n2. **Diff** - Compares new VDOM with previous VDOM\n3. **Patch** - Updates only the changed parts in real DOM\n\n```jsx\n// When state changes:\n// 1. New VDOM tree created\n// 2. React diffs old vs new\n// 3. Only changed nodes update\n\nfunction App() {\n  const [name, setName] = useState('World');\n  return (\n    <div>\n      <h1>Hello</h1>  {/* Won't re-render */}\n      <p>{name}</p>    {/* Only this updates */}\n    </div>\n  );\n}\n```\n\n## Reconciliation Algorithm:\n- Uses **keys** to identify elements in lists\n- Compares elements of same type (updates props)\n- Different types = destroy old, create new\n- O(n) complexity through heuristic diffing", "difficulty": "hard", "is_most_asked": False, "tags": ["virtual-dom", "reconciliation", "performance"]},
    {"id": "q-react-3", "domain_id": "d-react", "question": "What is useEffect and how does the dependency array work?", "answer": "**useEffect** lets you perform side effects in functional components.\n\n```jsx\nuseEffect(() => {\n  // Effect code\n  return () => { /* Cleanup */ };\n}, [dependencies]);\n```\n\n## Dependency Array Behavior:\n\n```jsx\n// Runs after EVERY render\nuseEffect(() => {\n  console.log('Every render');\n});\n\n// Runs ONCE on mount\nuseEffect(() => {\n  console.log('Mount only');\n}, []);\n\n// Runs when `count` changes\nuseEffect(() => {\n  console.log('Count changed:', count);\n}, [count]);\n```\n\n## Common Patterns:\n```jsx\n// Data fetching\nuseEffect(() => {\n  const controller = new AbortController();\n  fetch('/api/data', { signal: controller.signal })\n    .then(res => res.json())\n    .then(setData);\n  return () => controller.abort();\n}, []);\n\n// Event listeners\nuseEffect(() => {\n  window.addEventListener('resize', handleResize);\n  return () => window.removeEventListener('resize', handleResize);\n}, []);\n```", "difficulty": "easy", "is_most_asked": True, "tags": ["useEffect", "hooks", "lifecycle"]},
    # DSA
    {"id": "q-dsa-1", "domain_id": "d-dsa", "question": "What is Big O notation and why does it matter?", "answer": "**Big O notation** describes the upper bound of an algorithm's time or space complexity as input grows.\n\n## Common Complexities (fastest to slowest):\n\n| Big O | Name | Example |\n|-------|------|--------|\n| O(1) | Constant | Array access by index |\n| O(log n) | Logarithmic | Binary search |\n| O(n) | Linear | Linear search |\n| O(n log n) | Linearithmic | Merge sort |\n| O(n^2) | Quadratic | Bubble sort |\n| O(2^n) | Exponential | Recursive Fibonacci |\n\n```python\n# O(1) - Constant\ndef get_first(arr):\n    return arr[0]\n\n# O(n) - Linear\ndef find_max(arr):\n    max_val = arr[0]\n    for num in arr:\n        if num > max_val:\n            max_val = num\n    return max_val\n\n# O(n^2) - Quadratic\ndef bubble_sort(arr):\n    for i in range(len(arr)):\n        for j in range(len(arr) - 1):\n            if arr[j] > arr[j+1]:\n                arr[j], arr[j+1] = arr[j+1], arr[j]\n```\n\n**Interview tip:** Always discuss time AND space complexity.", "difficulty": "easy", "is_most_asked": True, "tags": ["big-o", "complexity", "fundamentals"]},
    {"id": "q-dsa-2", "domain_id": "d-dsa", "question": "How does a Binary Search Tree work?", "answer": "A **Binary Search Tree (BST)** is a tree where each node has at most two children, and:\n- Left child < Parent\n- Right child > Parent\n\n```python\nclass Node:\n    def __init__(self, val):\n        self.val = val\n        self.left = None\n        self.right = None\n\nclass BST:\n    def __init__(self):\n        self.root = None\n\n    def insert(self, val):\n        if not self.root:\n            self.root = Node(val)\n            return\n        self._insert(self.root, val)\n\n    def _insert(self, node, val):\n        if val < node.val:\n            if node.left:\n                self._insert(node.left, val)\n            else:\n                node.left = Node(val)\n        else:\n            if node.right:\n                self._insert(node.right, val)\n            else:\n                node.right = Node(val)\n\n    def search(self, val):\n        return self._search(self.root, val)\n\n    def _search(self, node, val):\n        if not node:\n            return False\n        if val == node.val:\n            return True\n        if val < node.val:\n            return self._search(node.left, val)\n        return self._search(node.right, val)\n```\n\n## Time Complexity:\n- **Average:** O(log n) for search, insert, delete\n- **Worst (unbalanced):** O(n)", "difficulty": "medium", "is_most_asked": False, "tags": ["trees", "bst", "data-structures"]},
    # Node.js
    {"id": "q-node-1", "domain_id": "d-nodejs", "question": "What is the difference between process.nextTick() and setImmediate()?", "answer": "Both schedule callbacks, but at different phases of the event loop.\n\n## `process.nextTick()`\n- Executes **before** any I/O events or timers\n- Runs at the end of the current operation\n- Can starve I/O if used recursively\n\n## `setImmediate()`\n- Executes in the **check phase** of the event loop\n- Runs **after** I/O events\n- Designed to execute after the poll phase\n\n```javascript\nsetImmediate(() => {\n  console.log('setImmediate');\n});\n\nprocess.nextTick(() => {\n  console.log('nextTick');\n});\n\nconsole.log('sync');\n\n// Output:\n// sync\n// nextTick\n// setImmediate\n```\n\n**Rule of thumb:**\n- Use `setImmediate()` for most async scheduling\n- Use `process.nextTick()` only when you need something to happen before I/O", "difficulty": "hard", "is_most_asked": False, "tags": ["event-loop", "async", "node-internals"]},
    {"id": "q-node-2", "domain_id": "d-nodejs", "question": "Explain the Node.js module system", "answer": "Node.js uses the **CommonJS** module system (and supports ES Modules).\n\n## CommonJS (require/module.exports)\n```javascript\n// math.js\nfunction add(a, b) { return a + b; }\nfunction multiply(a, b) { return a * b; }\n\nmodule.exports = { add, multiply };\n\n// app.js\nconst { add, multiply } = require('./math');\nconsole.log(add(2, 3)); // 5\n```\n\n## ES Modules (import/export)\n```javascript\n// math.mjs\nexport function add(a, b) { return a + b; }\nexport default function multiply(a, b) { return a * b; }\n\n// app.mjs\nimport multiply, { add } from './math.mjs';\n```\n\n## Module Resolution:\n1. **Core modules** (fs, path, http) - built-in\n2. **File modules** (./relative or /absolute paths)\n3. **node_modules** - walks up directory tree\n\n## Module Caching:\nModules are cached after first load. `require('./module')` returns same instance.", "difficulty": "easy", "is_most_asked": True, "tags": ["modules", "commonjs", "es-modules"]},
    # Python
    {"id": "q-py-1", "domain_id": "d-python", "question": "What are Python decorators?", "answer": "A **decorator** is a function that modifies the behavior of another function without changing its code.\n\n```python\ndef timer(func):\n    import time\n    def wrapper(*args, **kwargs):\n        start = time.time()\n        result = func(*args, **kwargs)\n        end = time.time()\n        print(f'{func.__name__} took {end - start:.2f}s')\n        return result\n    return wrapper\n\n@timer\ndef slow_function():\n    import time\n    time.sleep(1)\n    return 'Done'\n\n# Equivalent to: slow_function = timer(slow_function)\nslow_function()  # slow_function took 1.00s\n```\n\n## Common Built-in Decorators:\n```python\nclass MyClass:\n    @staticmethod\n    def utility():  # No self/cls\n        pass\n\n    @classmethod\n    def factory(cls):  # Gets class, not instance\n        return cls()\n\n    @property\n    def name(self):  # Accessed like attribute\n        return self._name\n```\n\n## Decorators with Arguments:\n```python\ndef repeat(n):\n    def decorator(func):\n        def wrapper(*args, **kwargs):\n            for _ in range(n):\n                result = func(*args, **kwargs)\n            return result\n        return wrapper\n    return decorator\n\n@repeat(3)\ndef greet(name):\n    print(f'Hello {name}')\n```", "difficulty": "medium", "is_most_asked": True, "tags": ["decorators", "functions", "advanced"]},
    # System Design
    {"id": "q-sd-1", "domain_id": "d-system-design", "question": "How would you design a URL shortener?", "answer": "## Requirements\n- Shorten long URLs to short links\n- Redirect short links to original URLs\n- Handle high read traffic\n- Track click analytics\n\n## High-Level Design\n\n```\nClient -> Load Balancer -> API Servers -> Cache (Redis) -> Database\n```\n\n## Key Components:\n\n### 1. URL Shortening\n```\nBase62 encoding: [a-zA-Z0-9] = 62 characters\n7 characters = 62^7 = ~3.5 trillion unique URLs\n```\n\n### 2. Database Schema\n```sql\nurls:\n  id: BIGINT (auto-increment)\n  short_code: VARCHAR(7) UNIQUE INDEX\n  original_url: TEXT\n  created_at: TIMESTAMP\n  click_count: INT DEFAULT 0\n```\n\n### 3. Read Flow (Redirect)\n1. User hits `short.url/abc123`\n2. Check **Redis cache** first\n3. If miss, query database\n4. Cache result, return 301/302 redirect\n\n### 4. Write Flow (Create)\n1. Receive long URL\n2. Generate unique ID (counter or hash)\n3. Base62 encode to short code\n4. Store in DB + cache\n\n## Scale Considerations:\n- **Read-heavy** (100:1 read/write ratio)\n- Use Redis for caching hot URLs\n- Database sharding by short_code hash\n- CDN for geographic distribution", "difficulty": "hard", "is_most_asked": True, "tags": ["url-shortener", "scalability", "caching"]},
]

async def seed_data():
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@interprep.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing_admin = await db.users.find_one({"email": admin_email})
    if existing_admin is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing_admin["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logger.info("Admin password updated")

    # Seed domains
    for domain in SEED_DOMAINS:
        existing = await db.domains.find_one({"id": domain["id"]})
        if not existing:
            domain["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.domains.insert_one(domain)
    logger.info("Domains seeded")

    # Seed questions
    for q in SEED_QUESTIONS:
        existing = await db.questions.find_one({"id": q["id"]})
        if not existing:
            q["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.questions.insert_one(q)
    logger.info("Questions seeded")

    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.domains.create_index("slug", unique=True)
    await db.domains.create_index("id", unique=True)
    await db.questions.create_index("domain_id")
    await db.questions.create_index("id", unique=True)

    # Write test credentials
    os.makedirs("memory", exist_ok=True)
    with open("memory/test_credentials.md", "w") as f:
        f.write(f"# Test Credentials\n\n## Admin\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n\n## Auth Endpoints\n- POST /api/auth/login\n- GET /api/auth/me\n- POST /api/auth/logout\n")

@app.on_event("startup")
async def startup():
    await seed_data()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
