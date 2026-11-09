from tests.conftest import make_organization


def test_organizations_list_hides_registered_email(client, db):
    org = make_organization(db)

    response = client.get("/api/organizations")

    assert response.status_code == 200
    item = next(row for row in response.json() if row["id"] == str(org.id))
    assert item == {"id": str(org.id), "slug": org.slug, "name": org.name}
