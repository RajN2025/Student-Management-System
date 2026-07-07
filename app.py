from flask import Flask, render_template, request, redirect
import mysql.connector
import os
from dotenv import load_dotenv

# Load local environment variables from .env file
load_dotenv()

app = Flask(__name__)

db = mysql.connector.connect(
    host=os.getenv("DB_HOST"),
    port=int(os.getenv("DB_PORT", 14270)),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database=os.getenv("DB_NAME")
)

cursor = db.cursor(dictionary=True)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/add', methods=['POST'])
def add():

    student_id = request.form['student_id']
    student_name = request.form['student_name']
    subject1 = request.form['subject1']
    subject2 = request.form['subject2']
    subject3 = request.form['subject3']
    subject4 = request.form['subject4']
    subject5 = request.form['subject5']

    sql = """
    INSERT INTO students
    (student_id, student_name, subject1, subject2, subject3, subject4, subject5)
    VALUES (%s,%s,%s,%s,%s,%s,%s)
    """

    values = (
        student_id,
        student_name,
        subject1,
        subject2,
        subject3,
        subject4,
        subject5
    )

    cursor.execute(sql, values)
    db.commit()

    return redirect('/view')


@app.route('/view')
def view():

    cursor.execute("SELECT * FROM students")

    students = cursor.fetchall()

    return render_template('view.html', students=students)


@app.route('/update', methods=['POST'])
def update():

    student_id = request.form['student_id']
    student_name = request.form['student_name']
    subject1 = request.form['subject1']
    subject2 = request.form['subject2']
    subject3 = request.form['subject3']
    subject4 = request.form['subject4']
    subject5 = request.form['subject5']

    sql = """
    UPDATE students
    SET
        student_name=%s,
        subject1=%s,
        subject2=%s,
        subject3=%s,
        subject4=%s,
        subject5=%s
    WHERE student_id=%s
    """

    values = (
        student_name,
        subject1,
        subject2,
        subject3,
        subject4,
        subject5,
        student_id
    )

    cursor.execute(sql, values)
    db.commit()

    return redirect('/view')


@app.route('/delete', methods=['POST'])
def delete():

    student_id = request.form['student_id']

    sql = "DELETE FROM students WHERE student_id=%s"

    cursor.execute(sql, (student_id,))
    db.commit()

    return redirect('/view')


@app.route('/search')
def search():
    return render_template('search.html')


@app.route('/student', methods=['POST'])
def student():

    student_id = request.form['student_id']

    sql = "SELECT * FROM students WHERE student_id=%s"

    cursor.execute(sql, (student_id,))

    student = cursor.fetchone()

    return render_template('student.html', student=student)


if __name__ == '__main__':
    app.run(debug=True)