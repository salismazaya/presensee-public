import json
from functools import lru_cache


@lru_cache(maxsize = 512)
def json_loads_cached(s: bytes | str):
    return json.loads(s)