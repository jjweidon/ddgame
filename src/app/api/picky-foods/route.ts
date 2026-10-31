import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { VALID_PLAYERS, PlayerCode } from '@/models/Game';
import PickyFood from '@/models/PickyFood';
import {
  PICKY_FOOD_CATEGORIES,
  PICKY_FOOD_NAME_MAX,
  PICKY_FOOD_NOTE_MAX,
  PickyFoodCategory,
  isPickyEater,
  normalizeFoodName
} from '@/constants/pickyFood';
import { getPlayerDisplayName } from '@/utils/playerNames';
import { josa } from '@/utils/korean';

const invalidEaterResponse = () =>
  NextResponse.json({ success: false, error: '편식 도감 대상자가 아닙니다.' }, { status: 400 });

// GET /api/picky-foods?eater=지
export async function GET(request: Request) {
  try {
    const eater = new URL(request.url).searchParams.get('eater');
    if (!isPickyEater(eater)) return invalidEaterResponse();

    await dbConnect();
    const foods = await PickyFood.find({ eater }).select({ normalizedName: 0 }).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: foods });
  } catch (error) {
    console.error('편식 목록 조회 오류:', error);
    return NextResponse.json(
      { success: false, error: '편식 목록을 조회하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { eater } = body;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const category: PickyFoodCategory = PICKY_FOOD_CATEGORIES.includes(body.category) ? body.category : '기타';
    const registrant: PlayerCode | undefined = VALID_PLAYERS.includes(body.registrant) ? body.registrant : undefined;

    if (!isPickyEater(eater)) return invalidEaterResponse();
    if (!name || name.length > PICKY_FOOD_NAME_MAX) {
      return NextResponse.json(
        { success: false, error: `음식 이름은 1~${PICKY_FOOD_NAME_MAX}자로 입력하세요.` },
        { status: 400 }
      );
    }
    if (note.length > PICKY_FOOD_NOTE_MAX) {
      return NextResponse.json(
        { success: false, error: `메모는 ${PICKY_FOOD_NOTE_MAX}자 이하여야 합니다.` },
        { status: 400 }
      );
    }

    await dbConnect();
    const normalizedName = normalizeFoodName(name);
    const existing = await PickyFood.findOne({ eater, normalizedName }).select({ name: 1, graduatedAt: 1 });
    if (existing) {
      const eaterName = getPlayerDisplayName(eater);
      return NextResponse.json(
        {
          success: false,
          error: existing.graduatedAt
            ? `'${existing.name}'${josa(existing.name, '은/는')} ${eaterName}${josa(eaterName, '이/가')} 이미 졸업한 음식이에요. 다시 안 먹는다면 목록에서 졸업 취소하세요.`
            : `'${existing.name}'${josa(existing.name, '은/는')} 이미 ${eaterName} 도감에 있어요.`
        },
        { status: 409 }
      );
    }

    const created = await PickyFood.create({
      eater,
      name,
      normalizedName,
      category,
      note: note || undefined,
      registrant
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json({ success: false, error: '이미 도감에 있는 음식이에요.' }, { status: 409 });
    }
    console.error('편식 음식 등록 오류:', error);
    return NextResponse.json(
      { success: false, error: error.message || '음식을 등록하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
