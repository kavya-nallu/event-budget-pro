import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Logic to switch between local and Azure backend automatically
const API = window.location.hostname === "localhost" 
  ? "http://localhost:5000/api" 
  : "https://YOUR-AZURE-APP-NAME.azurewebsites.net/api"; 

function App() {
  const [role, setRole] = useState(null); 
  const [authMode, setAuthMode] = useState(null); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [view, setView] = useState('form'); 
  const [expandedEvent, setExpandedEvent] = useState(null); 
  const [auth, setAuth] = useState({ username: '', password: '' });

  // Admin States
  const [eventName, setEventName] = useState('');
  const [masterBudget, setMasterBudget] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categories, setCategories] = useState([{ name: 'Food', amount: 0, coordRealName: '', assignedCoordinator: '', coordPassword: '' }]);
  const [allEvents, setAllEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Coordinator States
  const [myEvent, setMyEvent] = useState(null);
  const [myCategory, setMyCategory] = useState(null);
  const [localExpenses, setLocalExpenses] = useState([]);

  const allocatedBudget = categories.reduce((sum, cat) => sum + Number(cat.amount), 0);
  const remainingBudget = masterBudget - allocatedBudget;

  useEffect(() => {
    if (isLoggedIn && role === 'admin') {
      fetchEvents();
    }
  }, [isLoggedIn, role]);

  const getEventDays = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  };

  const fetchEvents = async () => {
    try {
      const res = await axios.get(`${API}/events/all`);
      setAllEvents(res.data);
    } catch (err) { console.error("Error fetching events:", err); }
  };

  /* ================= AUTH LOGIC ================= */
  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API}/users/login`, { ...auth, role });
      setIsLoggedIn(true);
      if (role === 'coordinator') fetchCoordinatorData(auth.username);
    } catch (err) { alert("Invalid Credentials!"); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/users/register`, { ...auth, role });
      alert("✅ Account Created!");
      setAuthMode("login");
    } catch { alert("❌ Failed"); }
  };

  /* ================= COORDINATOR FUNCTIONS ================= */
  const fetchCoordinatorData = async (username) => {
    try {
      const res = await axios.get(`${API}/events/all`);
      const foundEvent = res.data.find(ev => ev.categories.some(c => c.assignedCoordinator === username));
      if (foundEvent) {
        setMyEvent(foundEvent);
        const cat = foundEvent.categories.find(c => c.assignedCoordinator === username);
        setMyCategory(cat);
        const days = getEventDays(foundEvent.startDate, foundEvent.endDate);
        const initial = Array.from({ length: days }, (_, i) => 
          (cat.expenses && cat.expenses[i]) ? cat.expenses[i] : { 
              day: i + 1, hotelName: '', rooms: '', travelType: 'rent', vehicleName: '', fromLoc: '', toLoc: '',
              items: [{ itemName: '', itemAmount: 0 }], checkInDate: '', checkOutDate: ''
          }
        );
        setLocalExpenses(initial);
      }
    } catch (err) { alert("Error loading data"); }
  };

  const handleCoordSave = async () => {
    await axios.put(`${API}/events/update-expenses/${myEvent._id}`, {
      categoryId: myCategory._id, expenses: localExpenses
    });
    alert("✅ Changes Saved!");
  };

  /* ================= FIXED CSV REPORT LOGIC ================= */
  const downloadReport = (event, specificCategory = null) => {
    let csvRows = [];
    const headers = ["Category", "Coordinator", "Day", "Main Info", "Travel Type", "Vehicle", "From", "To", "Rooms", "Check-In", "Check-Out", "Cost Items", "Total Amount"];
    csvRows.push(headers.join(","));

    const catsToProcess = specificCategory ? [specificCategory] : event.categories;
    
    catsToProcess.forEach(cat => {
      if (cat.expenses && cat.expenses.length > 0) {
        cat.expenses.forEach(day => {
          const isTravel = cat.name.toLowerCase().includes('travel');
          const isStay = cat.name.toLowerCase().includes('stay');

          const rowData = [
            `"${cat.name}"`,
            `"${cat.coordRealName || 'N/A'}"`,
            `"Day ${day.day}"`,
            `"${day.hotelName || 'N/A'}"`,
            `"${isTravel ? day.travelType : 'N/A'}"`,
            `"${isTravel ? day.vehicleName : 'N/A'}"`,
            `"${isTravel ? day.fromLoc : 'N/A'}"`,
            `"${isTravel ? day.toLoc : 'N/A'}"`,
            `"${isStay ? day.rooms : 'N/A'}"`,
            `"${isStay ? day.checkInDate : 'N/A'}"`,
            `"${isStay ? day.checkOutDate : 'N/A'}"`,
            `"${day.items ? day.items.map(it => `${it.itemName}: ${it.itemAmount}`).join(" | ") : ""}"`,
            day.items ? day.items.reduce((s, i) => s + Number(i.itemAmount), 0) : 0
          ];
          csvRows.push(rowData.join(","));
        });
      } else {
        csvRows.push(`"${cat.name}","${cat.coordRealName}","N/A","Pending","N/A","N/A","N/A","N/A","N/A","N/A","N/A","N/A",0`);
      }
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${event.eventName}_Detailed_Report.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ================= ADMIN FUNCTIONS ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      for (let cat of categories) {
        await axios.post(`${API}/users/register`, { username: cat.assignedCoordinator, password: cat.coordPassword, role: 'coordinator' }).catch(() => null);
      }
      await axios.post(`${API}/events/add`, { eventName, categories, startDate, endDate, totalBudget: masterBudget });
      alert('Event Created!');
      fetchEvents();
      setView('list');
    } catch (err) { alert('Error'); }
  };

  const handleGoToEvent = (event) => { setSelectedEvent(JSON.parse(JSON.stringify(event))); setView('manage'); };

  const saveEventUpdates = async () => {
    await axios.put(`${API}/events/update-event/${selectedEvent._id}`, selectedEvent);
    alert("Updated!");
    fetchEvents();
    setView('list');
  };

  /* ================= UI RENDERING ================= */
  if (!isLoggedIn) {
    return (
      <div style={centerStyle}><div style={cardStyle}>
          {!role ? (
            <><h2>👑 Budget Pro</h2>
              <button onClick={() => setRole('admin')} style={adminButtonStyle}>Admin Portal</button>
              <button onClick={() => setRole('coordinator')} style={coordButtonStyle}>Coordinator Portal</button></>
          ) : !authMode ? (
            <><h3>{role.toUpperCase()}</h3>
              <button onClick={() => setAuthMode("login")} style={submitButtonStyle}>Have an Account</button>
              <button onClick={() => setAuthMode("signup")} style={coordButtonStyle}>Create New Account</button>
              <button onClick={() => setRole(null)} style={backButtonStyle}>← Back</button></>
          ) : (
            <form onSubmit={authMode === "login" ? handleAuth : handleRegister}>
              <h3>{role.toUpperCase()} {authMode.toUpperCase()}</h3>
              <input type="text" placeholder="Username" style={inputStyle} required onChange={e => setAuth({...auth, username: e.target.value})} />
              <input type="password" placeholder="Password" style={inputStyle} required onChange={e => setAuth({...auth, password: e.target.value})} />
              <button type="submit" style={submitButtonStyle}>{authMode === "login" ? "Login" : "Sign Up"}</button>
              <button type="button" onClick={() => setAuthMode(null)} style={backButtonStyle}>← Back</button>
            </form>
          )}
      </div></div>
    );
  }

  if (role === 'coordinator') {
    const isTravel = myCategory?.name?.toLowerCase().includes('travel');
    const isStay = myCategory?.name?.toLowerCase().includes('stay');

    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <div><h2>👋 {myCategory?.coordRealName}</h2><p>Category: <strong>{myCategory?.name}</strong></p></div>
          <div style={{display:'flex', gap:'10px'}}>
            <button onClick={() => downloadReport(myEvent, myCategory)} style={downloadButtonStyle}>📥 CSV</button>
            <button onClick={() => setIsLoggedIn(false)} style={logoutButtonStyle}>Logout</button>
          </div>
        </div>

        {localExpenses.map((day, dIdx) => (
          <div key={dIdx} style={dayCardStyle}>
            <h4>📅 Day {day.day}</h4>
            {isTravel && (
              <div style={{marginBottom: '15px'}}>
                <select style={inputStyle} value={day.travelType} onChange={e => {const n=[...localExpenses]; n[dIdx].travelType=e.target.value; setLocalExpenses(n)}}>
                  <option value="rent">Rent Vehicle</option>
                  <option value="own">Own Vehicle</option>
                </select>
                <input type="text" placeholder="Vehicle Name" style={inputStyle} value={day.vehicleName} onChange={e => {const n=[...localExpenses]; n[dIdx].vehicleName=e.target.value; setLocalExpenses(n)}} />
                <div style={{display:'flex', gap:'10px'}}>
                   <input type="text" placeholder="From" style={inputStyle} value={day.fromLoc} onChange={e => {const n=[...localExpenses]; n[dIdx].fromLoc=e.target.value; setLocalExpenses(n)}} />
                   <input type="text" placeholder="To" style={inputStyle} value={day.toLoc} onChange={e => {const n=[...localExpenses]; n[dIdx].toLoc=e.target.value; setLocalExpenses(n)}} />
                </div>
              </div>
            )}

            {isStay && (
              <div style={{marginBottom: '15px'}}>
                <input type="text" placeholder="Hotel Name" style={inputStyle} value={day.hotelName} onChange={e => {const n=[...localExpenses]; n[dIdx].hotelName=e.target.value; setLocalExpenses(n)}} />
                <input type="number" placeholder="Number of Rooms" style={inputStyle} value={day.rooms} onChange={e => {const n=[...localExpenses]; n[dIdx].rooms=e.target.value; setLocalExpenses(n)}} />
                <div style={{display:'flex', gap:'10px'}}>
                   <input type="date" style={inputStyle} value={day.checkInDate} onChange={e=>{const n=[...localExpenses]; n[dIdx].checkInDate=e.target.value; setLocalExpenses(n)}} />
                   <input type="date" style={inputStyle} value={day.checkOutDate} onChange={e=>{const n=[...localExpenses]; n[dIdx].checkOutDate=e.target.value; setLocalExpenses(n)}} />
                </div>
              </div>
            )}

            {!isTravel && !isStay && (
                <input type="text" placeholder="Business Name" style={inputStyle} value={day.hotelName} onChange={e => {const n=[...localExpenses]; n[dIdx].hotelName=e.target.value; setLocalExpenses(n)}} />
            )}

            {day.items.map((it, iIdx) => (
              <div key={iIdx} style={{display:'flex', gap:'8px', marginTop:'5px'}}>
                {!isStay && <input type="text" placeholder="Item Name" style={{...inputStyle, flex:2}} value={it.itemName} onChange={e => {const n=[...localExpenses]; n[dIdx].items[iIdx].itemName=e.target.value; setLocalExpenses(n)}} />}
                <input type="number" placeholder="₹ Amount" style={{...inputStyle, flex:1}} value={it.itemAmount} onChange={e => {const n=[...localExpenses]; n[dIdx].items[iIdx].itemAmount=e.target.value; setLocalExpenses(n)}} />
              </div>
            ))}
            <button onClick={() => {const n=[...localExpenses]; n[dIdx].items.push({itemName:'', itemAmount:0}); setLocalExpenses(n)}} style={addBtnSmall}>+ Add Amount Field</button>
          </div>
        ))}
        <button onClick={handleCoordSave} style={submitButtonStyle}>Save Expenses</button>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2>👑 Admin Dashboard</h2>
        <div>
          <button onClick={() => setView(view === 'form' ? 'list' : 'form')} style={navButtonStyle}>{view === 'form' ? '👁️ View Events' : '➕ New Event'}</button>
          <button onClick={() => setIsLoggedIn(false)} style={logoutButtonStyle}>Logout</button>
        </div>
      </div>

      {view === 'form' ? (
        <form onSubmit={handleSubmit} style={dayCardStyle}>
          <input type="text" placeholder="Event Name" style={inputStyle} required value={eventName} onChange={e => setEventName(e.target.value)} />
          <div style={{display:'flex', gap:'10px'}}><input type="date" style={inputStyle} required onChange={e => setStartDate(e.target.value)} /><input type="date" style={inputStyle} required onChange={e => setEndDate(e.target.value)} /></div>
          <div style={budgetSummaryStyle}>Budget Status: ₹{allocatedBudget} / ₹{masterBudget}
            <input type="number" placeholder="Total Budget" style={{...inputStyle, marginTop: '10px'}} onChange={e => setMasterBudget(Number(e.target.value))} />
          </div>
          {categories.map((cat, i) => (
            <div key={i} style={assignmentCardStyle}>
              <input type="text" placeholder="Category" value={cat.name} style={inputStyle} onChange={e => {const n=[...categories]; n[i].name=e.target.value; setCategories(n)}} />
              <input type="number" placeholder="Budget" style={inputStyle} value={cat.amount} onChange={e => {const n=[...categories]; n[i].amount=e.target.value; setCategories(n)}} />
              <input type="text" placeholder="Coord Name" style={inputStyle} value={cat.coordRealName} onChange={e => {const n=[...categories]; n[i].coordRealName=e.target.value; setCategories(n)}} />
              <input type="text" placeholder="Login ID" style={inputStyle} value={cat.assignedCoordinator} onChange={e => {const n=[...categories]; n[i].assignedCoordinator=e.target.value; setCategories(n)}} />
              <input type="password" placeholder="Pass" style={inputStyle} value={cat.coordPassword} onChange={e => {const n=[...categories]; n[i].coordPassword=e.target.value; setCategories(n)}} />
            </div>
          ))}
          <button type="button" onClick={() => setCategories([...categories, {name:'', amount:0, coordRealName:'', assignedCoordinator:'', coordPassword:''}])} style={plusButtonStyle}>+ Add Category</button>
          <button type="submit" style={submitButtonStyle}>Create Event</button>
        </form>
      ) : (
        allEvents.map((ev, i) => (
          <div key={i} style={eventCardStyle}>
            <div style={{display:'flex', justifyContent:'space-between'}}><h4>{ev.eventName}</h4><button onClick={() => handleGoToEvent(ev)} style={goToButtonStyle}>Edit</button></div>
            <div style={{display:'flex', gap:'10px', marginTop:'10px'}}>
              <button onClick={() => downloadReport(ev)} style={downloadButtonStyle}>📥 CSV Report</button>
              <button onClick={() => setExpandedEvent(expandedEvent === ev._id ? null : ev._id)} style={viewDetailBtn}>Details</button>
            </div>
            {expandedEvent === ev._id && ev.categories.map((c, idx) => (
              <div key={idx} style={expandedCategoryStyle}>
                <strong style={{fontSize: '15px'}}>📌 {c.name} ({c.coordRealName})</strong>
                {c.expenses?.map((d, di) => (
                  <div key={di} style={{fontSize: '13px', marginTop:'10px', borderLeft:'3px solid #4169E1', paddingLeft:'10px', background: '#FFF', borderRadius: '4px', padding: '5px'}}>
                    <strong>Day {d.day}</strong>: 
                    {c.name.toLowerCase().includes('travel') ? (
                       <span> 🚕 {d.travelType?.toUpperCase()}: {d.vehicleName} ({d.fromLoc} → {d.toLoc})</span>
                    ) : c.name.toLowerCase().includes('stay') ? (
                       <span> 🏨 {d.hotelName} | 🔑 Rooms: {d.rooms} ({d.checkInDate} to {d.checkOutDate})</span>
                    ) : (
                       <span> 🏢 {d.hotelName || 'N/A'}</span>
                    )}
                    <div style={{marginTop: '5px', color: '#555'}}>
                      {d.items?.map((item, ii) => (
                        <div key={ii}>• {item.itemName || "Cost"}: ₹{item.itemAmount}</div>
                      ))}
                      <strong style={{color: '#1A1A1B'}}>Total: ₹{d.items?.reduce((s,i)=>s+Number(i.itemAmount),0) || 0}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

// --- Styles ---
const containerStyle = { padding: '20px', maxWidth: '900px', margin: 'auto', background: '#F5F7FA', minHeight: '100vh' };
const headerStyle = { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '20px', borderBottom: '2px solid #DDD', paddingBottom: '10px' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #DDD', marginBottom: '8px', boxSizing: 'border-box' };
const budgetSummaryStyle = { background: '#1A1A1B', color: '#FFF', padding: '15px', borderRadius: '8px', margin: '15px 0' };
const submitButtonStyle = { width: '100%', background: '#4169E1', color: '#FFF', padding: '12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' };
const dayCardStyle = { background: '#FFF', padding: '20px', borderRadius: '10px', marginBottom: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' };
const assignmentCardStyle = { background: '#F9F9F9', padding: '15px', borderRadius: '8px', marginBottom: '10px', borderLeft: '4px solid #4169E1' };
const eventCardStyle = { background: '#FFF', padding: '15px', borderRadius: '10px', marginBottom: '15px', border: '1px solid #EEE' };
const downloadButtonStyle = { background: '#28a745', color: '#FFF', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' };
const logoutButtonStyle = { background: '#dc3545', color: '#FFF', padding: '8px 15px', border: 'none', borderRadius: '5px', cursor: 'pointer' };
const centerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' };
const cardStyle = { background: '#FFF', padding: '30px', borderRadius: '12px', boxShadow: '0 5px 15px rgba(0,0,0,0.1)', textAlign: 'center', width: '320px' };
const adminButtonStyle = { width: '100%', padding: '12px', margin: '10px 0', background: '#333', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer' };
const coordButtonStyle = { width: '100%', padding: '12px', margin: '10px 0', background: '#4169E1', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer' };
const backButtonStyle = { marginTop:'10px', background:'none', border:'none', color:'#4169E1', cursor:'pointer' };
const plusButtonStyle = { background: '#EEE', color: '#333', border: '1px dashed #999', padding: '10px', borderRadius: '6px', width: '100%', marginBottom: '10px' };
const addBtnSmall = { marginTop:'5px', cursor:'pointer', border: '1px solid #4169E1', background: 'none', color: '#4169E1', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' };
const navButtonStyle = { background: '#4169E1', color: '#FFF', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer' };
const goToButtonStyle = { background: '#333', color: '#FFF', border: 'none', padding: '5px 12px', borderRadius: '4px' };
const viewDetailBtn = { background: '#FFF', border: '1px solid #333', padding: '8px 15px', borderRadius: '5px' };
const expandedCategoryStyle = { marginTop:'10px', padding:'10px', background:'#f0f4f8', borderRadius:'5px' };

export default App;