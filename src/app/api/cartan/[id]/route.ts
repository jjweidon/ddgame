import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import Game, { VALID_PLAYERS } from '@/models/Game';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 기록 ID입니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { rankEntries } = body;

    if (!Array.isArray(rankEntries) || rankEntries.length === 0) {
      return NextResponse.json(
        { success: false, error: '등수 정보(rankEntries)가 필요합니다.' },
        { status: 400 }
      );
    }

    const allPlayers = rankEntries.flatMap((entry: any) => entry.players || []);
    const uniquePlayers = new Set(allPlayers);
    if (allPlayers.length < 3 || allPlayers.length > 5) {
      return NextResponse.json(
        { success: false, error: '카탄은 3명 이상 5명 이하만 참여할 수 있습니다.' },
        { status: 400 }
      );
    }
    if (allPlayers.length !== uniquePlayers.size) {
      return NextResponse.json(
        { success: false, error: '동일 플레이어가 중복 등록되었습니다.' },
        { status: 400 }
      );
    }
    for (const player of allPlayers) {
      if (!VALID_PLAYERS.includes(player)) {
        return NextResponse.json(
          { success: false, error: `유효하지 않은 플레이어: ${player}` },
          { status: 400 }
        );
      }
    }

    const updated = await Game.findOneAndUpdate(
      { _id: id, gameType: 'cartan' },
      { $set: { cartanResult: { rankEntries } } },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: '해당 카탄 기록을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('카탄 기록 수정 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || '카탄 기록 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 기록 ID입니다.' },
        { status: 400 }
      );
    }

    const deleted = await Game.findOneAndDelete({ _id: id, gameType: 'cartan' });
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '해당 카탄 기록을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: '카탄 기록이 삭제되었습니다.' });
  } catch (error: any) {
    console.error('카탄 기록 삭제 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || '카탄 기록 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
