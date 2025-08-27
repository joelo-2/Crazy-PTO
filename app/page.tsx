"use client";
import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Loc = 'CompanyA'|'CompanyB'|'CompanyC';

const sb = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AppPage(){
  const [user,setUser] = useState<any>(null);
  const [tab,setTab] = useState<'dashboard'|'request'|'admin'>('dashboard');
  const [msg,setMsg] = useState<string>('');

  useEffect(()=>{(async()=>{
    const { data: { user } } = await sb.auth.getUser();
    setUser(user);
  })()},[]);

  if(!user) return <Login />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Nav setTab={setTab} tab={tab} onSignOut={async()=>{ await sb.auth.signOut(); location.reload(); }} />
      {tab==='dashboard' && <Dashboard />}
      {tab==='request' && <Request />}
      {tab==='admin' && <Admin />}
      {msg && <p className="mt-4 text-sm">{msg}</p>}
    </div>
  );
}

function Nav({tab,setTab,onSignOut}:{tab:'dashboard'|'request'|'admin', setTab:(t:any)=>void, onSignOut:()=>void}){
  return (
    <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border rounded-2xl shadow px-4 py-2 flex gap-4 items-center">
      <span className="font-semibold">{process.env.NEXT_PUBLIC_APP_NAME || 'PTO Portal'}</span>
      <button className={b(tab==='dashboard')} onClick={()=>setTab('dashboard')}>Dashboard</button>
      <button className={b(tab==='request')} onClick={()=>setTab('request')}>Request Time Off</button>
      <button className={b(tab==='admin')} onClick={()=>setTab('admin')}>Admin</button>
      <span className="ml-auto" />
      <button className="text-sm underline" onClick={onSignOut}>Sign out</button>
    </div>
  );
}
function b(active:boolean){ return `px-3 py-1 rounded ${active?'bg-black text-white':'hover:bg-slate-100'}` }

function Login(){
  const [email,setEmail] = useState("");
  const [sent,setSent] = useState(false);
  async function send(e:React.FormEvent){
    e.preventDefault();
    await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/` }});
    setSent(true);
  }
  return (
    <div className="max-w-md mx-auto mt-24 bg-white p-6 rounded-2xl shadow">
      <h1 className="text-xl font-semibold mb-3">Sign in</h1>
      {sent ? <p>Check your email for a sign-in link.</p> : (
        <form onSubmit={send} className="space-y-3">
          <input className="w-full border rounded px-3 py-2" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
          <button className="px-4 py-2 rounded bg-black text-white">Send magic link</button>
        </form>
      )}
    </div>
  );
}

function Dashboard(){
  const [me,setMe] = useState<any>(null);
  const [bank,setBank] = useState<number>(0);
  const [upcoming,setUpcoming] = useState<any[]>([]);

  useEffect(()=>{(async()=>{
    const { data: { user } } = await sb.auth.getUser();
    if(!user) return;
    const emp = await sb.from('employees').select('id,full_name,home_location').eq('user_id', user.id).maybeSingle();
    setMe(emp.data);
    if(emp.data){
      const bank = await sb.from('pto_banks').select('days_remaining').eq('employee_id', emp.data.id).maybeSingle();
      setBank(bank.data?.days_remaining ?? 0);
      const up = await sb.from('time_off_requests').select('start_date,end_date,status').eq('employee_id', emp.data.id).order('start_date', {ascending:true}).limit(5);
      setUpcoming(up.data||[]);
    }
  })()},[]);

  return (
    <div className="grid gap-6 md:grid-cols-2 mt-4">
      <section className="bg-white rounded-2xl shadow p-5">
        <h2 className="text-lg font-semibold mb-2">My PTO Bank</h2>
        <div className="text-4xl font-bold">{bank} <span className="text-base font-normal">days</span></div>
      </section>
      <section className="bg-white rounded-2xl shadow p-5">
        <h2 className="text-lg font-semibold mb-2">Upcoming</h2>
        <ul className="space-y-2">
          {upcoming.map((u:any,i:number)=> (
            <li key={i} className="flex justify-between border-b py-2">
              <span>{u.start_date} → {u.end_date}</span>
              <span className="text-xs">{u.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Request(){
  const [me,setMe] = useState<any>(null);
  const [start,setStart] = useState("");
  const [end,setEnd] = useState("");
  const [note,setNote] = useState("");
  const [msg,setMsg] = useState("");

  useEffect(()=>{(async()=>{
    const { data: { user } } = await sb.auth.getUser();
    if(!user) return;
    const { data } = await sb.from('employees').select('id,home_location').eq('user_id', user.id).single();
    setMe(data);
  })()},[]);

  async function submit(e:React.FormEvent){
    e.preventDefault();
    const s = new Date(start), eD = new Date(end);
    if(isNaN(s.getTime())||isNaN(eD.getTime())|| eD < s){ setMsg('Choose valid dates'); return; }
    const days = Math.floor((eD.getTime()-s.getTime())/(1000*60*60*24)) + 1;
    const { error } = await sb.from('time_off_requests').insert({ employee_id: me.id, loc: me.home_location, start_date: start, end_date: end, days_requested: days, note });
    setMsg(error? error.message : 'Request submitted');
  }

  return (
    <form onSubmit={submit} className="max-w-md mt-6 bg-white p-6 rounded-2xl shadow space-y-3">
      <h1 className="text-xl font-semibold">Request Time Off (Full Days)</h1>
      <div className="grid grid-cols-2 gap-3">
        <input type="date" className="border rounded px-3 py-2" value={start} onChange={e=>setStart(e.target.value)} />
        <input type="date" className="border rounded px-3 py-2" value={end} onChange={e=>setEnd(e.target.value)} />
      </div>
      <textarea className="w-full border rounded px-3 py-2" placeholder="Notes (optional)" value={note} onChange={e=>setNote(e.target.value)} />
      <button className="px-4 py-2 rounded bg-black text-white">Submit</button>
      {msg && <p className="text-sm mt-2">{msg}</p>}
    </form>
  );
}

function Admin(){
  const [tab,setTab] = useState<'employees'|'approvals'|'blackouts'>('employees');
  return (
    <div className="mt-6">
      <div className="flex gap-2 mb-3">
        <button className={b(tab==='employees')} onClick={()=>setTab('employees')}>Employees</button>
        <button className={b(tab==='approvals')} onClick={()=>setTab('approvals')}>Approvals</button>
        <button className={b(tab==='blackouts')} onClick={()=>setTab('blackouts')}>Blackout Dates</button>
      </div>
      {tab==='employees' && <Employees />}
      {tab==='approvals' && <Approvals />}
      {tab==='blackouts' && <Blackouts />}
    </div>
  );
}

function Employees(){
  const [rows,setRows] = useState<any[]>([]);
  const [form,setForm] = useState({ full_name:'', email:'', home_location:'CompanyA' as Loc });

  async function load(){
    const { data } = await sb.from('employees').select('id,full_name,email,home_location,pto_banks(days_remaining)').order('full_name');
    setRows(data||[]);
  }
  useEffect(()=>{ load() },[]);

  async function add(e:React.FormEvent){
    e.preventDefault();
    const { data, error } = await sb.from('employees').insert({ full_name: form.full_name, email: form.email, home_location: form.home_location }).select('id').single();
    if(!error && data){
      await sb.from('pto_banks').insert({ employee_id: data.id, days_remaining: 0 });
      setForm({ full_name:'', email:'', home_location:'CompanyA' });
      await load();
    }
  }
  async function setBank(id:string, days:number){
    await sb.from('pto_banks').upsert({ employee_id: id, days_remaining: days });
    await load();
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={add} className="bg-white rounded-2xl shadow p-5 grid md:grid-cols-4 gap-3">
        <input className="border rounded px-3 py-2" placeholder="Full name" value={form.full_name} onChange={e=>setForm({...form, full_name: e.target.value})} />
        <input className="border rounded px-3 py-2" placeholder="Email" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} />
        <select className="border rounded px-3 py-2" value={form.home_location} onChange={e=>setForm({...form, home_location: e.target.value as Loc})}>
          <option>CompanyA</option><option>CompanyB</option><option>CompanyC</option>
        </select>
        <button className="rounded bg-black text-white px-4">Add</button>
      </form>

      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b"><th className="p-3">Name</th><th>Email</th><th>Location</th><th>PTO Days</th></tr></thead>
          <tbody>
            {rows.map((r:any)=> (
              <tr key={r.id} className="border-b">
                <td className="p-3">{r.full_name}</td>
                <td>{r.email}</td>
                <td>{r.home_location}</td>
                <td><input type="number" className="border rounded px-2 py-1 w-24" defaultValue={r.pto_banks?.days_remaining ?? 0}
                  onBlur={(e)=>setBank(r.id, Number(e.currentTarget.value))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Approvals(){
  const [rows,setRows] = useState<any[]>([]);
  const [msg,setMsg] = useState("");
  async function load(){
    const { data } = await sb.from('time_off_requests')
      .select('id, start_date, end_date, days_requested, status, note, loc, employees(full_name)')
      .neq('status','CANCELLED')
      .order('start_date', {ascending: true});
    setRows(data || []);
  }
  useEffect(()=>{ load() },[]);

  async function act(id:string, approve:boolean){
    if(approve){
      const { data: { user } } = await sb.auth.getUser();
      const { error } = await sb.rpc('approve_request', { p_request_id: id, p_decider: user!.id });
      setMsg(error? error.message : 'Approved');
    } else {
      const { error } = await sb.from('time_off_requests').update({ status: 'DENIED' }).eq('id', id);
      setMsg(error? error.message : 'Denied');
    }
    await load();
  }

  return (
    <div className="bg-white rounded-2xl shadow">
      <div className="p-4 border-b flex justify-between items-center">
        <h1 className="text-lg font-semibold">Approvals</h1>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left border-b"><th className="p-3">Employee</th><th>Dates</th><th>Days</th><th>Loc</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {rows.map((r:any)=> (
            <tr key={r.id} className="border-b">
              <td className="p-3">{r.employees?.full_name}</td>
              <td>{r.start_date} → {r.end_date}</td>
              <td>{r.days_requested}</td>
              <td>{r.loc}</td>
              <td>{r.status}</td>
              <td className="space-x-2">
                <button onClick={()=>act(r.id,true)} className="px-2 py-1 rounded bg-emerald-600 text-white">Approve</button>
                <button onClick={()=>act(r.id,false)} className="px-2 py-1 rounded bg-rose-600 text-white">Deny</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Blackouts(){
  const [loc,setLoc] = useState<Loc>('CompanyA');
  const [start,setStart] = useState("");
  const [end,setEnd] = useState("");
  const [reason,setReason] = useState("");
  const [rows,setRows] = useState<any[]>([]);

  async function load(){
    const { data } = await sb.from('blackout_dates').select('*').eq('loc', loc).order('start_date');
    setRows(data||[]);
  }
  useEffect(()=>{ load() },[loc]);

  async function add(e:React.FormEvent){
    e.preventDefault();
    const { error } = await sb.from('blackout_dates').insert({ loc, start_date: start, end_date: end, reason });
    if(!error){ setStart(""); setEnd(""); setReason(""); }
    await load();
  }
  async function del(id:string){
    await sb.from('blackout_dates').delete().eq('id', id);
    await load();
  }

  return (
    <div className="grid gap-6">
      <div className="bg-white rounded-2xl shadow p-5">
        <h1 className="text-lg font-semibold mb-3">Blackout Dates</h1>
        <select className="border rounded px-3 py-2" value={loc} onChange={e=>setLoc(e.target.value as Loc)}>
          <option>CompanyA</option><option>CompanyB</option><option>CompanyC</option>
        </select>
        <form onSubmit={add} className="mt-3 grid md:grid-cols-4 gap-3">
          <input type="date" className="border rounded px-3 py-2" value={start} onChange={e=>setStart(e.target.value)} />
          <input type="date" className="border rounded px-3 py-2" value={end} onChange={e=>setEnd(e.target.value)} />
          <input className="border rounded px-3 py-2" placeholder="Reason (optional)" value={reason} onChange={e=>setReason(e.target.value)} />
          <button className="rounded bg-black text-white px-4">Add</button>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b"><th className="p-3">Dates</th><th>Reason</th><th></th></tr></thead>
          <tbody>
            {rows.map(r=> (
              <tr key={r.id} className="border-b">
                <td className="p-3">{r.start_date} → {r.end_date}</td>
                <td>{r.reason}</td>
                <td className="text-right p-3"><button onClick={()=>del(r.id)} className="px-2 py-1 rounded bg-rose-600 text-white">Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
