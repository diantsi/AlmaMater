from tests.conftest import make_faculty, make_topic


def test_topics_list(member_client, db):
    topic = make_topic(db, name="AAA test topic")

    response = member_client.get("/api/topics")

    assert response.status_code == 200
    assert {"id": str(topic.id), "code": topic.code, "name": topic.name} in response.json()


def test_faculties_list(member_client, db):
    faculty = make_faculty(db, name="AAA test faculty")

    response = member_client.get("/api/faculties")

    assert response.status_code == 200
    assert {"id": str(faculty.id), "code": faculty.code, "name": faculty.name} in response.json()
