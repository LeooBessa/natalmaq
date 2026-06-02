from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class ItemPedidoIn(BaseModel):
    produto_id: str
    quantidade: int = Field(ge=1, le=999)


class EnderecoIn(BaseModel):
    cep: str
    rua: str
    numero: str
    bairro: str
    cidade: str
    uf: str
    complemento: str | None = None

    @field_validator("cep")
    @classmethod
    def cep_digits(cls, v: str) -> str:
        d = "".join(c for c in v if c.isdigit())
        if len(d) != 8:
            raise ValueError("CEP inválido")
        return d


class PedidoIn(BaseModel):
    cliente_nome: str = Field(min_length=2, max_length=120)
    cliente_telefone: str = Field(min_length=10, max_length=20)
    cliente_email: EmailStr | None = None
    tipo_entrega: Literal["entrega", "retirada"] = "entrega"
    endereco: EnderecoIn | None = None
    observacoes: str | None = Field(default=None, max_length=2000)
    itens: list[ItemPedidoIn] = Field(min_length=1, max_length=100)
    frete_valor: float = Field(default=0, ge=0)
    cupom_codigo: str | None = None
    desconto_valor: float = Field(default=0, ge=0)
    cliente_id: str | None = None


class FreteIn(BaseModel):
    cep: str
    peso_total: float = Field(ge=0)

    @field_validator("cep")
    @classmethod
    def cep_digits(cls, v: str) -> str:
        d = "".join(c for c in v if c.isdigit())
        if len(d) != 8:
            raise ValueError("CEP inválido")
        return d


class FreteOut(BaseModel):
    valor: float
    prazo_dias: int
    regiao: str


class PedidoCriado(BaseModel):
    id: str
    numero: int
    whatsapp_url: str
    total: float


class AvaliacaoIn(BaseModel):
    produto_id: str
    cliente_nome: str = Field(min_length=2, max_length=120)
    nota: int = Field(ge=1, le=5)
    comentario: str | None = Field(default=None, max_length=2000)


def jsonable(obj: Any) -> Any:
    """Helper genérico para coerção em respostas."""
    return obj
