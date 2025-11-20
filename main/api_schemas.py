from typing import Any, List, Literal

from ninja import Schema


class LoginSchema(Schema):
    username: str
    password: str


class ErrorSchema(Schema):
    detail: str

class SuccessSchema(Schema):
    data: Any


class DataUploadDetailSchema(Schema):
    action: Literal["absen", "lock", "unlock"]
    data: str

class DataUploadSchema(Schema):
    data: List[DataUploadDetailSchema]


class ChangePasswordSchema(Schema):
    old_password: str
    new_password: str


class RequestDocumentSchema(Schema):
    kelas: int
    nowa: str
    bulan: int
    tahun: int
