import unittest
import uuid

import app

# Helper


def bytes_to_str(b):
    return ''.join(chr(x) for x in (b))


class AppTestCase(unittest.TestCase):

    def setUp(self):
        self.client = app.app.test_client()

    def test_uuid_generated(self):
        resp = self.client.get('/')
        assert uuid.UUID(bytes_to_str(resp.data))
