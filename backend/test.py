from redis import Redis
from flask import Flask

app = Flask(__name__)
redis_client = Redis(host='192.168.1.42', port=6379, decode_responses=True)

@app.route("/ping")
def ping():
    try:
        redis_client.set("test", "ok")
        return redis_client.get("test")
    except Exception as e:
        return str(e), 500

if __name__ == "__main__":
    app.run(debug=True)

