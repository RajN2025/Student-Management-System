from flask import Flask, render_template, request, redirect, g, jsonify
import mysql.connector
import sqlite3
import os
from dotenv import load_dotenv

# Load local environment variables from .env file
load_dotenv()

app = Flask(__name__)

db_initialized = False

# SQLite connection wrapper to emulate mysql-connector cursor interface
class SQLiteConnectionWrapper:
    def __init__(self, conn):
        self.conn = conn
    
    def cursor(self, dictionary=True):
        return SQLiteCursorWrapper(self.conn.cursor(), dictionary)
        
    def commit(self):
        self.conn.commit()
        
    def close(self):
        self.conn.close()

    def is_connected(self):
        return True

class SQLiteCursorWrapper:
    def __init__(self, cursor, dictionary=True):
        self.cursor = cursor
        self.dictionary = dictionary
        
    def execute(self, sql, params=()):
        # Convert %s placeholders to ? placeholders for SQLite compatibility
        sql = sql.replace('%s', '?')
        self.cursor.execute(sql, params)
        
    def fetchall(self):
        rows = self.cursor.fetchall()
        if self.dictionary and self.cursor.description:
            columns = [col[0] for col in self.cursor.description]
            return [dict(zip(columns, row)) for row in rows]
        return rows
        
    def fetchone(self):
        row = self.cursor.fetchone()
        if row and self.dictionary and self.cursor.description:
            columns = [col[0] for col in self.cursor.description]
            return dict(zip(columns, row))
        return row
        
    def close(self):
        self.cursor.close()

# Request-context database connection helper
def get_db():
    global db_initialized
    if 'db' not in g:
        mysql_host = os.getenv("DB_HOST")
        if mysql_host:
            try:
                g.db = mysql.connector.connect(
                    host=mysql_host,
                    port=int(os.getenv("DB_PORT", 14270)),
                    user=os.getenv("DB_USER"),
                    password=os.getenv("DB_PASSWORD"),
                    database=os.getenv("DB_NAME")
                )
            except Exception as e:
                print("Warning: MySQL connection failed, falling back to SQLite:", e)
                conn = sqlite3.connect('students.db')
                g.db = SQLiteConnectionWrapper(conn)
        else:
            conn = sqlite3.connect('students.db')
            g.db = SQLiteConnectionWrapper(conn)

        if not db_initialized:
            try:
                cursor = g.db.cursor()
                cursor.execute("""
                CREATE TABLE IF NOT EXISTS students (
                    student_id INT PRIMARY KEY,
                    student_name VARCHAR(50),
                    subject1 INT,
                    subject2 INT,
                    subject3 INT,
                    subject4 INT,
                    subject5 INT
                )
                """)
                cursor.close()
                db_initialized = True
            except Exception as e:
                # Log warning but do not crash the app
                print("Warning: Could not automatically verify or create 'students' table:", e)
    return g.db

# Automatically teardown database connections at request end
@app.teardown_appcontext
def teardown_db(exception):
    db = g.pop('db', None)
    if db is not None:
        try:
            db.close()
        except Exception:
            pass


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

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(sql, values)
    db.commit()
    cursor.close()

    return redirect('/view')


@app.route('/view')
def view():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM students")
    students = cursor.fetchall()
    cursor.close()

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

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(sql, values)
    db.commit()
    cursor.close()

    return redirect('/view')


@app.route('/delete', methods=['POST'])
def delete():
    student_id = request.form['student_id']

    sql = "DELETE FROM students WHERE student_id=%s"

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(sql, (student_id,))
    db.commit()
    cursor.close()

    return redirect('/view')


@app.route('/search')
def search():
    return render_template('search.html')


@app.route('/student', methods=['POST'])
def student():
    student_id = request.form['student_id']

    sql = "SELECT * FROM students WHERE student_id=%s"

    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute(sql, (student_id,))
    student = cursor.fetchone()
    cursor.close()

    return render_template('student.html', student=student)


@app.route('/api/stats')
def api_stats():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM students")
    students = cursor.fetchall()
    cursor.close()
    
    if not students:
        return jsonify({
            'total_students': 0,
            'class_average': 0,
            'subject_averages': {
                'Subject 1': 0,
                'Subject 2': 0,
                'Subject 3': 0,
                'Subject 4': 0,
                'Subject 5': 0
            },
            'grade_distribution': {'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0},
            'top_student': None
        })
        
    total_students = len(students)
    
    s1_total = s2_total = s3_total = s4_total = s5_total = 0
    top_avg = -1
    top_student = None
    
    grade_distribution = {'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0}
    sum_averages = 0
    
    for s in students:
        s1 = s['subject1'] or 0
        s2 = s['subject2'] or 0
        s3 = s['subject3'] or 0
        s4 = s['subject4'] or 0
        s5 = s['subject5'] or 0
        
        s1_total += s1
        s2_total += s2
        s3_total += s3
        s4_total += s4
        s5_total += s5
        
        avg = (s1 + s2 + s3 + s4 + s5) / 5.0
        sum_averages += avg
        
        if avg > top_avg:
            top_avg = avg
            top_student = {
                'id': s['student_id'],
                'name': s['student_name'],
                'average': round(avg, 2)
            }
            
        if avg >= 90:
            grade_distribution['A'] += 1
        elif avg >= 80:
            grade_distribution['B'] += 1
        elif avg >= 70:
            grade_distribution['C'] += 1
        elif avg >= 60:
            grade_distribution['D'] += 1
        else:
            grade_distribution['F'] += 1
            
    return jsonify({
        'total_students': total_students,
        'class_average': round(sum_averages / total_students, 2),
        'subject_averages': {
            'Subject 1': round(s1_total / total_students, 2),
            'Subject 2': round(s2_total / total_students, 2),
            'Subject 3': round(s3_total / total_students, 2),
            'Subject 4': round(s4_total / total_students, 2),
            'Subject 5': round(s5_total / total_students, 2)
        },
        'grade_distribution': grade_distribution,
        'top_student': top_student
    })


if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)