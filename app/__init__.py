from flask import Flask, Response
import uuid

app = Flask(__name__)


@app.route("/")
def hello():
    return Response(str(uuid.uuid4()), status=200, mimetype='text/plain')
