import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [role, setRole] = useState(null); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState('form'); 
  const [showHistory, setShowHistory] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState(null); 
  const [auth, setAuth] = useState({ username: '', password: '' });

  // Admin States
  const [eventName, setEventName] = useState('');
  const [masterBudget, setMasterBudget] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categories, setCategories] = useState([{ name: 'Food', amount: 0, coordRealName: '', assignedCoordinator: '', coordPassword: '' }]);
  const [allEvents, setAllEvents] = useState([]);

  // Coordinator States
  const [myEvent, setMyEvent] = useState(null);
  const [myCategory, setMyCategory] = useState(null);
  const [localExpenses, setLocalExpenses] = useState([]);

  const allocatedBudget = categories.reduce((sum, cat) => sum + Number(cat.amount), 0);
  const remainingBudget = masterBudget - allocatedBudget;

  const getEventDays = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`http://localhost:5000/api/users/login`, { ...auth, role });
      setIsLoggedIn(true);
      if (role === 'coordinator') fetchCoordinatorData(auth.username);
    } catch (err) { alert("Invalid Credentials!"); }
  };

  const fetchCoordinatorData = async (username) => {
    const res = await axios.get('http://localhost:5000/api/events/all');
    const foundEvent = res.data.find(ev => ev.categories.some(c => c.assignedCoordinator === username));
    if (foundEvent) {
      setMyEvent(foundEvent);
      const cat = foundEvent.categories.find(c => c.assignedCoordinator === username);
      setMyCategory(cat);
      const days = getEventDays(foundEvent.startDate, foundEvent.endDate);
      const initial = Array.from({ length: days }, (_, i) => 
        (cat.expenses && cat.expenses[i]) ? cat.expenses[i] : { day: i + 1, hotelName: '', items: [{ itemName: '', itemAmount: 0 }] }
      );
      setLocalExpenses(initial);
    }
  };

  const handleCoordSave = async () => {
    await axios.put(`http://localhost:5000/api/events/update-expenses/${myEvent._id}`, {
      categoryId: myCategory._id, expenses: localExpenses
    });
    alert("✅ Expenses Saved to Admin!");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (allocatedBudget > masterBudget) return alert("Budget Exceeded!");
    try {
      for (let cat of categories) {
        await axios.post(`http://localhost:5000/api/users/register`, { 
          username: cat.assignedCoordinator, password: cat.coordPassword, role: 'coordinator' 
        }).catch(() => null);
      }
      await axios.post('http://localhost:5000/api/events/add', { 
        eventName, categories, startDate, endDate, totalBudget: masterBudget 
      });
      alert('✅ Event Created!');
      setEventName(''); setCategories([{ name: 'Food', amount: 0, coordRealName: '', assignedCoordinator: '', coordPassword: '' }]);
    } catch (err) { alert('❌ Error: Check required fields'); }
  };

  const fetchEvents = async () => {
    const res = await axios.get('http://localhost:5000/api/events/all');
    setAllEvents(res.data);
    setView('list');
  };

  // --- REUSABLE DOWNLOAD LOGIC ---
  const downloadCSV = (event, specificCategory = null) => {
    let csv = "Category,Coordinator,Day,Hotel,Item,Amount\n";
    const catsToProcess = specificCategory ? [specificCategory] : event.categories;
    
    catsToProcess.forEach(cat => {
      if (cat.expenses?.length > 0) {
        cat.expenses.forEach(day => day.items.forEach(it => {
          csv += `${cat.name},${cat.coordRealName},Day ${day.day},${day.hotelName},${it.itemName},${it.itemAmount}\n`;
        }));
      } else { csv += `${cat.name},${cat.coordRealName},N/A,N/A,Pending,0\n`; }
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = specificCategory ? `${event.eventName}_MyReport.csv` : `${event.eventName}_MasterReport.csv`;
    link.click();
  };

  if (!isLoggedIn) {
    return (
      <div style={centerStyle}>
        <div style={cardStyle}>
          {!role ? (
            <><h2>🔐 Budget Pro</h2>
              <button onClick={() => setRole('admin')} style={adminButtonStyle}>Admin</button>
              <button onClick={() => setRole('coordinator')} style={coordButtonStyle}>Coordinator</button></>
          ) : (
            <form onSubmit={handleAuth}>
              <h3>{role.toUpperCase()} LOGIN</h3>
              <input type="text" placeholder="Username" style={inputStyle} required onChange={e => setAuth({...auth, username: e.target.value})} />
              <input type="password" placeholder="Password" style={inputStyle} required onChange={e => setAuth({...auth, password: e.target.value})} />
              <button type="submit" style={submitButtonStyle}>Login</button>
              <button type="button" onClick={() => setRole(null)} style={{marginTop:'10px', background:'none', border:'none', cursor:'pointer', color:'blue'}}>Back</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // --- COORDINATOR VIEW ---
  if (role === 'coordinator') {
    return (
      <div style={{ padding: '20px', maxWidth: '800px', margin: 'auto' }}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems: 'center'}}>
          <div>
            <h2>👋 {myCategory?.coordRealName || auth.username}</h2>
            <p style={{fontSize: '18px', color: '#555'}}>Category: <strong>{myCategory?.name}</strong></p>
          </div>
          <div style={{display: 'flex', gap: '10px'}}>
             <button onClick={() => downloadCSV(myEvent, myCategory)} style={downloadButtonStyle}>📥 My CSV</button>
             <button onClick={() => setIsLoggedIn(false)}>Logout</button>
          </div>
        </div>
        <div style={budgetSummaryStyle}><h4>{myEvent?.eventName} - Limit: ₹{myCategory?.amount}</h4></div>
        {localExpenses.map((day, dIdx) => (
          <div key={dIdx} style={dayCardStyle}>
            <h4>Day {day.day}</h4>
            <input type="text" placeholder="Hotel Name" style={inputStyle} value={day.hotelName} onChange={e => {const n=[...localExpenses]; n[dIdx].hotelName=e.target.value; setLocalExpenses(n)}} />
            {day.items.map((it, iIdx) => (
              <div key={iIdx} style={{display:'flex', gap:'5px', marginTop:'5px'}}>
                <input type="text" placeholder="Item" style={{...inputStyle, flex:2}} value={it.itemName} onChange={e => {const n=[...localExpenses]; n[dIdx].items[iIdx].itemName=e.target.value; setLocalExpenses(n)}} />
                <input type="number" placeholder="₹" style={{...inputStyle, flex:1}} value={it.itemAmount} onChange={e => {const n=[...localExpenses]; n[dIdx].items[iIdx].itemAmount=e.target.value; setLocalExpenses(n)}} />
              </div>
            ))}
            <button onClick={() => {const n=[...localExpenses]; n[dIdx].items.push({itemName:'', itemAmount:0}); setLocalExpenses(n)}} style={{marginTop:'5px'}}>+ Item</button>
          </div>
        ))}
        <button onClick={handleCoordSave} style={submitButtonStyle}>Save Expenses</button>
      </div>
    );
  }

  // --- ADMIN VIEW ---
  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: 'auto' }}>
      <div style={{display:'flex', justifyContent:'space-between'}}>
        <h2>👨‍💼 Admin Dashboard</h2>
        <div>
          <button onClick={() => view === 'form' ? fetchEvents() : setView('form')}>{view === 'form' ? 'View Events' : 'New Event'}</button>
          <button onClick={() => setIsLoggedIn(false)} style={{marginLeft:'10px'}}>Logout</button>
        </div>
      </div>
      <hr />
      {view === 'form' ? (
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Event Name" style={inputStyle} required value={eventName} onChange={e => setEventName(e.target.value)} />
          <div style={{display:'flex', gap:'10px'}}><input type="date" style={inputStyle} required onChange={e => setStartDate(e.target.value)} /><input type="date" style={inputStyle} required onChange={e => setEndDate(e.target.value)} /></div>
          <div style={budgetSummaryStyle}>Rem: ₹{remainingBudget} <input type="number" placeholder="Master Budget ₹" required style={inputStyle} onChange={e => setMasterBudget(Number(e.target.value))} /></div>
          {categories.map((cat, i) => (
            <div key={i} style={assignmentCardStyle}>
              <div style={{display:'flex', gap:'10px'}}>
                <input type="text" placeholder="Category" value={cat.name} style={inputStyle} onChange={e => {const n=[...categories]; n[i].name=e.target.value; setCategories(n)}} />
                <input type="number" placeholder="₹ Amount" style={inputStyle} onChange={e => {const n=[...categories]; n[i].amount=e.target.value; setCategories(n)}} />
              </div>
              <input type="text" placeholder="Coordinator Name" style={inputStyle} value={cat.coordRealName} onChange={e => {const n=[...categories]; n[i].coordRealName=e.target.value; setCategories(n)}} />
              <div style={{display:'flex', gap:'10px'}}>
                <input type="text" placeholder="Login ID" style={inputStyle} value={cat.assignedCoordinator} onChange={e => {const n=[...categories]; n[i].assignedCoordinator=e.target.value; setCategories(n)}} />
                <input type="password" placeholder="Password" style={inputStyle} value={cat.coordPassword} onChange={e => {const n=[...categories]; n[i].coordPassword=e.target.value; setCategories(n)}} />
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setCategories([...categories, {name:'', amount:0, coordRealName:'', assignedCoordinator:'', coordPassword:''}])}>+ Category</button>
          <button type="submit" style={submitButtonStyle}>Initialize Event</button>
        </form>
      ) : (
        allEvents.map((ev, i) => (
          <div key={i} style={{...eventCardStyle, position:'relative'}}>
            <button onClick={() => {if(window.confirm("Delete?")) axios.delete(`http://localhost:5000/api/events/${ev._id}`).then(()=>fetchEvents())}} style={deleteButtonStyle}>✖</button>
            <h4>{ev.eventName} (₹{ev.totalBudget})</h4>
            <div style={{marginBottom:'10px'}}>
                <button onClick={() => downloadCSV(ev)} style={downloadButtonStyle}>📥 Master CSV</button>
                <button onClick={() => setExpandedEvent(expandedEvent === ev._id ? null : ev._id)} style={{cursor: 'pointer'}}>View Coord Details</button>
            </div>
            
            {expandedEvent === ev._id && ev.categories.map((c, idx) => (
              <div key={idx} style={{marginTop:'15px', fontSize:'13px', background:'#f1f1f1', padding:'10px', borderRadius: '5px'}}>
                <strong style={{color: '#007bff'}}>📌 {c.name} ({c.coordRealName}):</strong>
                {c.expenses?.length > 0 ? c.expenses.map((d, di) => (
                  <div key={di} style={{paddingLeft: '10px', marginTop: '5px', borderLeft: '2px solid #ccc'}}>
                    <strong>Day {d.day}:</strong> {d.hotelName || "No Hotel"}
                    <ul style={{margin: '2px 0'}}>
                        {d.items.map((item, ii) => (
                            <li key={ii}>{item.itemName}: ₹{item.itemAmount}</li>
                        ))}
                    </ul>
                  </div>
                )) : <p style={{fontSize: '11px', color: 'gray'}}>No data submitted.</p>}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '5px', boxSizing: 'border-box' };
const budgetSummaryStyle = { background: '#d4edda', padding: '15px', borderRadius: '8px', margin: '15px 0' };
const submitButtonStyle = { width: '100%', background: '#007bff', color: 'white', padding: '12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' };
const dayCardStyle = { background: '#f8f9fa', border: '1px solid #ddd', padding: '15px', borderRadius: '8px', marginBottom: '15px' };
const assignmentCardStyle = {background:'#fff', padding:'15px', borderRadius:'8px', marginBottom:'15px', border:'1px solid #ccc'};
const eventCardStyle = { background: 'white', border: '1px solid #ddd', padding: '15px', borderRadius: '8px', marginBottom: '15px' };
const downloadButtonStyle = { background: '#ffc107', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', marginRight:'10px', fontWeight: 'bold' };
const deleteButtonStyle = { position: 'absolute', top: '10px', right: '10px', background: '#ff4d4d', color: 'white', border: 'none', borderRadius: '50%', width: '25px', height: '25px', cursor: 'pointer' };
const centerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' };
const cardStyle = { background: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', width:'320px' };
const adminButtonStyle = { display: 'block', width: '100%', padding: '12px', marginBottom: '10px', background: '#333', color: 'white', border: 'none', cursor:'pointer' };
const coordButtonStyle = { display: 'block', width: '100%', padding: '12px', background: '#007bff', color: 'white', border: 'none', cursor:'pointer' };

export default App;