"""Verify FastAPI routes are registered - run this to test before starting server"""
import sys
import traceback

try:
    from app.main import app
    print("\n" + "="*60)
    print("FastAPI Routes Verification")
    print("="*60 + "\n")
    
    routes_found = []
    for route in app.routes:
        if hasattr(route, 'path') and hasattr(route, 'methods'):
            methods = ', '.join(sorted([m for m in route.methods if m not in {'HEAD', 'OPTIONS'}]))
            if methods:
                routes_found.append((route.path, methods))
                print(f"✓ {route.path:30} [{methods}]")
    
    print("\n" + "="*60)
    print(f"Total routes: {len(routes_found)}")
    
    # Check critical routes
    critical_routes = ['/embed/pdf', '/chat/ask', '/health']
    missing = [r for r in critical_routes if not any(route[0] == r for route in routes_found)]
    
    if missing:
        print(f"\n⚠ WARNING: Missing routes: {missing}")
        sys.exit(1)
    else:
        print("\n✓ All critical routes are registered!")
        print("\nYou can now start the server with:")
        print("  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload")
        sys.exit(0)
        
except Exception as e:
    print(f"\n✗ ERROR: Failed to import app: {e}")
    traceback.print_exc()
    sys.exit(1)


