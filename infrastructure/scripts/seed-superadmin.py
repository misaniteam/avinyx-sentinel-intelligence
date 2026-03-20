#!/usr/bin/env python3
"""Seed script to create the initial super admin user."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "packages", "shared"))
# Also check /packages/shared (Docker container layout)
sys.path.insert(0, "/packages/shared")

from sentinel_shared.database.session import get_engine, get_session_factory
from sentinel_shared.models.user import User
from sentinel_shared.auth.password import hash_password
from sqlalchemy import select, func


async def seed():
    factory = get_session_factory()
    async with factory() as session:
        result = await session.execute(
            select(func.count()).select_from(User).where(User.is_super_admin == True)
        )
        if result.scalar() > 0:
            print("Super admin already exists. Skipping.")
            return

        user = User(
            email="admin@sentinel.dev",
            password_hash=hash_password("changeme123"),
            full_name="Super Admin",
            is_super_admin=True,
            tenant_id=None,
        )
        session.add(user)
        await session.commit()
        print(f"Super admin created: admin@sentinel.dev")


if __name__ == "__main__":
    asyncio.run(seed())
