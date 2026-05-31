import { NextResponse } from 'next/server';
import { initDB, checkAndUpdateSystemStates } from '../../../database/db.js';

export async function GET() {
  try {
    initDB();
    checkAndUpdateSystemStates();
    return NextResponse.json({ success: true, message: '資料庫初始化與系統狀態更新成功！' });
  } catch (error) {
    console.error('API Init Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
