import React, { useState, useEffect } from 'react';
import './App.css';
import { API, Storage } from 'aws-amplify';
import { withAuthenticator } from '@aws-amplify/ui-react';
import { AmplifySignOut } from './components/authenticator';
import { listNotes } from './graphql/queries';
import { createNote as createNoteMutation, deleteNote as deleteNoteMutation } from './graphql/mutations';

const initialFormState = { name: '', description: '' }

function App() {
  const [notes, setNotes] = useState([]);
  const [formData, setFormData] = useState(initialFormState);

  // list of notes, initialized to empty arr
  useEffect(() => {
    fetchNotes();
  }, []);


  async function fetchNotes() {
    const apiData = await API.graphql({ query: listNotes });
    const notesFromAPI = apiData.data.listNotes.items;

    // for every note in the list, set the note image value
    // from S3 bucket if exists
    await Promise.all(notesFromAPI.map(async note => {
      if (note.image) {

        // get the image based on name from the bucket
        const image = await Storage.get(note.image);

        // replace string image name with return value of s3 get (a real image)
        note.image = image
      }
    }))
    setNotes(apiData.data.listNotes.items);
  }

  async function createNote() {
    if (!formData.name || !formData.description) return;
    await API.graphql({ query: createNoteMutation, variables: { input: formData } });

    if (formData.image) {
      const image = await Storage.get(formData.image)
      formData.image = image
    }
    setNotes([ ...notes, formData ]);
    setFormData(initialFormState);
  }

  async function deleteNote({ id }) {

    // filter current notes to not match deleteion target
    const newNotesArray = notes.filter(note => note.id !== id);

    // update state for all but deletion target
    setNotes(newNotesArray);

    // send the query and pass ID of deletion target to mutation
    await API.graphql({ query: deleteNoteMutation, variables: { input: { id } }});
  }

  // if there is an image on submission store it
  async function onChange(e) {

    // test file existence
    if (!e.target.files[0]) return;

    const file = e.target.files[0]
    
    // set formdata image key to filename
    setFormData({ ...formData, image: file.name});

    // store the file in bucket
    await Storage.put(file.name, file)

    // re-render list of notes to include stored file
    fetchNotes()
  }

  return (
    <div className="App">
      <h1>Notes App</h1>
      <input
        onChange={e => setFormData({ ...formData, 'name': e.target.value})}
        placeholder="Note name"
        value={formData.name}
      />
      <input
        onChange={e => setFormData({ ...formData, 'description': e.target.value})}
        placeholder="Note description"
        value={formData.description}
      />
      <input 
        type="file"
        onChange={onChange}
      />
      <button onClick={createNote}>Create Note</button>
      <div style={{marginBottom: 30}}>
        {
          notes.map(note => (
            <div key={note.id || note.name}>
              <h2>{note.name}</h2>
              <p>{note.description}</p>
              <button onClick={() => deleteNote(note)}>Delete note</button>
              {
                note.image && <img src={note.image} style={{width: 400}} alt="the note addition"/>
              }
            </div>
          ))
        }
      </div>
      <AmplifySignOut />
    </div>
  );
}

export default withAuthenticator(App);
