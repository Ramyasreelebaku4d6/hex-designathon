from urllib.parse import quote_plus

from pydantic_settings import BaseSettings


class Settings(BaseSettings):    # Azure SQL
    SQL_USER_NAME: str
    SQL_PASSWORD: str
    SQL_SERVER: str
    SQL_DATABASE: str
    SQL_DRIVER: str = "ODBC Driver 18 for SQL Server"

    # Azure AI Foundry
    MODEL_ENDPOINT: str
    MODEL_NAME: str
    MODEL_DEPLOYMENT: str
    MODEL_SUBSCRIPTION_KEY: str
    MODEL_API_VERSION: str = "2024-02-01"

    # App settings
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    @property
    def DATABASE_URL(self) -> str:
        # URL-encode credentials so special chars (e.g. @ in passwords) don't break the host
        user = quote_plus(self.SQL_USER_NAME)
        password = quote_plus(self.SQL_PASSWORD)
        driver = quote_plus(self.SQL_DRIVER)
        return (
            f"mssql+pyodbc://{user}:{password}"
            f"@{self.SQL_SERVER}/{self.SQL_DATABASE}"
            f"?driver={driver}"
            f"&Encrypt=yes&TrustServerCertificate=no"
        )
    class Config:
        env_file = ".env"

settings = Settings()