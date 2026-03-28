from sentinel_shared.ai.base import BaseAIProvider


class AIProviderFactory:
    _providers: dict[str, type[BaseAIProvider]] = {}

    @classmethod
    def register(cls, name: str, provider_class: type[BaseAIProvider]):
        cls._providers[name] = provider_class

    @classmethod
    def get_provider(cls, name: str, config: dict | None = None) -> BaseAIProvider:
        provider_class = cls._providers.get(name)
        if provider_class is None:
            raise ValueError(
                f"Unknown AI provider: {name}. Available: {list(cls._providers.keys())}"
            )
        return provider_class(**(config or {}))
