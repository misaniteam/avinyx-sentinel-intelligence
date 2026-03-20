from sqlalchemy import event
from sentinel_shared.database.session import tenant_context


def apply_tenant_filter(mapper, connection, target):
    """Auto-set tenant_id on new objects."""
    current_tenant = tenant_context.get()
    if current_tenant and hasattr(target, "tenant_id") and target.tenant_id is None:
        target.tenant_id = current_tenant


def setup_tenant_filtering(session_factory):
    """Register tenant filtering events."""

    @event.listens_for(session_factory, "do_orm_execute")
    def _add_tenant_filter(orm_execute_state):
        current_tenant = tenant_context.get()
        if current_tenant and not orm_execute_state.is_column_load and not orm_execute_state.is_relationship_load:
            orm_execute_state.statement = orm_execute_state.statement.options(
            ).execution_options(tenant_id=current_tenant)

    @event.listens_for(session_factory, "after_begin")
    def _set_tenant_on_new(session, transaction, connection):
        pass  # Tenant set via apply_tenant_filter on individual objects
