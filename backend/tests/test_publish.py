"""Tests for the Revit handoff publish path.

Two isolated pieces, neither of which touches PostGIS or a real Postgres:

  * ``upsert_published`` — exercised against a SQLite table created from the
    portable ``published_projects`` model alone (no Site/Geometry tables);
  * ``auth.get_current_user`` — with the Google call (``auth._verify``) stubbed.

Run from backend/ (venv active)::

    python -m unittest discover -s tests -t . -v
"""
from __future__ import annotations

import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import auth
from app.publish_service import upsert_published
from app.published_model import PublishedProject

SAMPLE_EXPORT = {
    "healtharch_version": "1.0",
    "project": {"id": "proj-1", "name": "Cedar Wing"},
    "site": {
        "address": "123 Main St",
        "coordinates": {"lat": 40.7, "lng": -74.0},
        "lot_area_sqm": 5000.0,
    },
    "site_intelligence": {"healthcare_constraints": {"fgi_version": "2022"}},
    "bubble_diagram": {"nodes": [{"id": "d1"}], "edges": [], "program": {"total_beds": 20}},
    "uploaded_files": [],
}


class UpsertTest(unittest.TestCase):

    def setUp(self) -> None:
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
            future=True,
        )
        # Create ONLY the handoff table — proves it's portable (no PostGIS dep).
        PublishedProject.__table__.create(bind=engine)
        self.sm = sessionmaker(bind=engine, future=True)

    def test_insert_populates_broken_out_columns(self) -> None:
        with self.sm() as db:
            row = upsert_published(
                db, google_sub="sub-A", email="a@x.com",
                project_id="proj-1", project_name="Cedar Wing", export=SAMPLE_EXPORT,
            )
            db.commit()
            self.assertEqual(row.address, "123 Main St")
            self.assertEqual(row.lat, 40.7)
            self.assertEqual(row.lng, -74.0)
            self.assertEqual(row.lot_area_sqm, 5000.0)
            self.assertEqual(row.site_analysis["healthcare_constraints"]["fgi_version"], "2022")
            self.assertEqual(row.bubble_diagram["program"]["total_beds"], 20)
            self.assertEqual(row.export_json["project"]["name"], "Cedar Wing")

    def test_republish_updates_in_place(self) -> None:
        with self.sm() as db:
            first = upsert_published(
                db, google_sub="sub-A", email="a@x.com",
                project_id="proj-1", project_name="Cedar Wing", export=SAMPLE_EXPORT,
            )
            db.commit()
            first_id = first.id

        with self.sm() as db:
            updated = dict(SAMPLE_EXPORT, project={"id": "proj-1", "name": "Cedar Wing v2"})
            second = upsert_published(
                db, google_sub="sub-A", email="a@x.com",
                project_id="proj-1", project_name="Cedar Wing v2", export=updated,
            )
            db.commit()
            self.assertEqual(second.id, first_id)        # same row reused
            self.assertEqual(second.name, "Cedar Wing v2")

        with self.sm() as db:
            self.assertEqual(db.query(PublishedProject).count(), 1)

    def test_distinct_users_and_projects_coexist(self) -> None:
        with self.sm() as db:
            upsert_published(db, google_sub="sub-A", email="a", project_id="proj-1", project_name="P1", export=SAMPLE_EXPORT)
            upsert_published(db, google_sub="sub-A", email="a", project_id="proj-2", project_name="P2", export=SAMPLE_EXPORT)
            upsert_published(db, google_sub="sub-B", email="b", project_id="proj-1", project_name="P1B", export=SAMPLE_EXPORT)
            db.commit()
            self.assertEqual(db.query(PublishedProject).count(), 3)

    def test_missing_site_is_tolerated(self) -> None:
        export = {"project": {"id": "p", "name": "n"}}  # no site / intel / bubble
        with self.sm() as db:
            row = upsert_published(
                db, google_sub="s", email=None, project_id="p", project_name="n", export=export,
            )
            db.commit()
            self.assertIsNone(row.address)
            self.assertIsNone(row.lat)
            self.assertIsNone(row.site_analysis)
            self.assertEqual(row.export_json["project"]["name"], "n")


class AuthTest(unittest.TestCase):

    def setUp(self) -> None:
        self._orig = auth._verify

    def tearDown(self) -> None:
        auth._verify = self._orig

    def test_valid_bearer_returns_identity(self) -> None:
        auth._verify = lambda token, client_id: {"sub": "123", "email": "a@b.com", "name": "A"}
        ident = auth.get_current_user(authorization="Bearer good-token")
        self.assertEqual(ident.sub, "123")
        self.assertEqual(ident.email, "a@b.com")

    def test_missing_header_is_401(self) -> None:
        with self.assertRaises(HTTPException) as cm:
            auth.get_current_user(authorization=None)
        self.assertEqual(cm.exception.status_code, 401)

    def test_non_bearer_scheme_is_401(self) -> None:
        with self.assertRaises(HTTPException) as cm:
            auth.get_current_user(authorization="Basic abc")
        self.assertEqual(cm.exception.status_code, 401)

    def test_bad_token_is_401(self) -> None:
        def boom(token, client_id):
            raise ValueError("token expired")

        auth._verify = boom
        with self.assertRaises(HTTPException) as cm:
            auth.get_current_user(authorization="Bearer bad")
        self.assertEqual(cm.exception.status_code, 401)

    def test_token_without_sub_is_401(self) -> None:
        auth._verify = lambda token, client_id: {"email": "a@b.com"}
        with self.assertRaises(HTTPException) as cm:
            auth.get_current_user(authorization="Bearer weird")
        self.assertEqual(cm.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
