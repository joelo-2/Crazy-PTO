import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function icsEscape(s:string){
  return s.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
}

export async function GET(req: NextRequest, { params }: { params: { loc: string } }){
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const loc = params.loc as 'CompanyA'|'CompanyB'|'CompanyC';
  const { data: rows } = await supabase.from('time_off_requests').select('start_date,end_date,employees(full_name)').eq('loc', loc).eq('status','APPROVED');

  const lines: string[] = [
    'BEGIN:VCALENDAR','VERSION:2.0',`PRODID:-//PTO Portal//${loc}//EN`,`X-WR-CALNAME:PTO - ${loc}`
  ];
  for(const r of rows||[]){
    const dtStart = `${r.start_date.replace(/-/g,'')}T000000Z`;
    const dtEnd = `${new Date(new Date(r.end_date).getTime()+24*60*60*1000).toISOString().slice(0,10).replace(/-/g,'')}T000000Z`;
    const summary = icsEscape(`${r.employees?.full_name} PTO`);
    lines.push('BEGIN:VEVENT',`DTSTART:${dtStart}`,`DTEND:${dtEnd}`,`SUMMARY:${summary}`,'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return new Response(lines.join('\r\n'), { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
}
