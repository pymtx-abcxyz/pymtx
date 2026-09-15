class SettlementError(ValueError):
    """Base error for AR settlement failures."""


class MoneyError(SettlementError):
    """Invalid monetary amount."""


class CurrencyMismatch(SettlementError):
    """Documents in a settlement group do not share a currency."""


class CustomerMismatch(SettlementError):
    """An allocation or document mix spans more than one customer."""


class OverAllocation(SettlementError):
    """An explicit allocation exceeds remaining invoice or receipt balance."""


class UnknownDocument(SettlementError):
    """An allocation references a document that is not in the settlement set."""
