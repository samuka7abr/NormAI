class ReportNotFound(Exception):
    pass


class ColumnsMismatch(ValueError):
    def __init__(self, missing: list[str], extra: list[str]) -> None:
        self.missing = missing
        self.extra = extra
        super().__init__(f"Missing columns: {missing}. Extra columns: {extra}.")


class ReportNotReady(Exception):
    pass


class InvalidApprovalTransition(ValueError):
    pass
