import os
from flask import Flask, render_template, request, jsonify
import gpxpy
import gpxpy.gpx
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# SQLAlchemy Setup
DATABASE_URI = 'sqlite:///database.db'
engine = create_engine(DATABASE_URI, echo=True)
Base = declarative_base() #erstellt basis modell
Session = sessionmaker(bind=engine)

class Track(Base):
    __tablename__ = 'tracks'
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    fahrer = Column(String, nullable=True)

class Coordinate(Base):
    __tablename__ = 'coordinates'
    id = Column(Integer, primary_key=True, autoincrement=True)
    track_id = Column(Integer, ForeignKey('tracks.id'), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

# Initialisiere die Datenbank
def initialize_database():
    Base.metadata.create_all(engine)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/drivers', methods=['GET'])
def get_drivers():
    #Alchemy Regeln Session öffnen, query= abfrage, session schließen
    session = Session()
    drivers = session.query(Track.fahrer).distinct().filter(Track.fahrer.isnot(None)).all()
    session.close()
    return jsonify([driver[0] for driver in drivers])

@app.route('/loadtracks', methods=['GET'])
def loadAllTracks():
    fahrer = request.args.get('fahrer')
    session = Session()

    if fahrer:
        tracks = session.query(Track.id, Track.name).filter(Track.fahrer == fahrer).all()
    else:
        tracks = session.query(Track.id, Track.name).all()

    session.close()
    return jsonify([{'id': t[0], 'name': t[1]} for t in tracks])

@app.route('/track/<int:track_id>', methods=['GET'])
def get_track(track_id):
    session = Session()
    coordinates = session.query(Coordinate.latitude, Coordinate.longitude).filter(Coordinate.track_id == track_id).all()
    session.close()
    return jsonify([{'latitude': c[0], 'longitude': c[1]} for c in coordinates])

@app.route('/upload', methods=['POST'])
def upload_gpx():
    if 'file' not in request.files:
        return 'No file part', 400

    file = request.files['file']
    if file.filename == '':
        return 'No selected file', 400

    if file and file.filename.endswith('.gpx'):
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(filepath)

        dateiname = file.filename
        teile = dateiname.split('_')
        fahrer = teile[1]

        with open(filepath, 'r') as gpx_file:
            gpx = gpxpy.parse(gpx_file)

        session = Session()

        new_track = Track(name=file.filename, file_path=filepath, fahrer=fahrer)
        session.add(new_track)
        session.commit()
        track_id = new_track.id

        for track in gpx.tracks:
            for track_segment in track.segments:
                for point in track_segment.points:
                    new_coordinate = Coordinate(track_id=track_id, latitude=point.latitude, longitude=point.longitude)
                    session.add(new_coordinate)

        session.commit()
        session.close()
        return 'File uploaded and processed', 201

    return 'Invalid file type', 400

@app.route('/track/<int:track_id>', methods=['DELETE'])
def delete_track(track_id):
    session = Session()

    # Löschen der Koordinaten des Tracks
    session.query(Coordinate).filter(Coordinate.track_id == track_id).delete()

    # Track-Informationen abrufen
    track = session.query(Track).filter(Track.id == track_id).first()

    if track:
        file_path = track.file_path
        # Löschen der Datei, wenn sie existiert
        if os.path.exists(file_path):
            os.remove(file_path)

        session.delete(track)

    session.commit()
    session.close()

    return '', 204

if __name__ == '__main__':
    initialize_database()
    app.run(debug=True, host="127.0.0.1", port=5000)
