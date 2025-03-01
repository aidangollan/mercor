import { NextRequest, NextResponse } from 'next/server';
import { Person, PersonModel } from '~/server/db/models/person';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');
    
    if (name) {
      const person = await PersonModel.getByName(name);
      
      if (!person) {
        return NextResponse.json({ error: 'Person not found' }, { status: 404 });
      }
      
      return NextResponse.json(person);
    }
    
    const people = await PersonModel.getAll();
    return NextResponse.json(people);
  } catch (error) {
    console.error('Error fetching people:', error);
    return NextResponse.json({ error: 'Failed to fetch people' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.name || body.clout_score === undefined || !body.linkedin_url) {
      return NextResponse.json(
        { error: 'Missing required fields: name, clout_score, and linkedin_url are required' },
        { status: 400 }
      );
    }
    
    const person: Person = {
      name: body.name,
      clout_score: body.clout_score,
      linkedin_url: body.linkedin_url
    };
    
    const createdPerson = await PersonModel.create(person);
    return NextResponse.json(createdPerson, { status: 201 });
  } catch (error) {
    console.error('Error creating person:', error);
    return NextResponse.json({ error: 'Failed to create person' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.name) {
      return NextResponse.json(
        { error: 'Missing required field: name is required for updates' },
        { status: 400 }
      );
    }
    
    const updates: Partial<Person> = {};
    
    if (body.clout_score !== undefined) updates.clout_score = body.clout_score;
    if (body.linkedin_url !== undefined) updates.linkedin_url = body.linkedin_url;
    if (body.new_name !== undefined) updates.name = body.new_name;
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No update fields provided' },
        { status: 400 }
      );
    }
    
    const updatedPerson = await PersonModel.update(body.name, updates);
    
    if (!updatedPerson) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }
    
    return NextResponse.json(updatedPerson);
  } catch (error) {
    console.error('Error updating person:', error);
    return NextResponse.json({ error: 'Failed to update person' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');
    
    if (!name) {
      return NextResponse.json(
        { error: 'Missing required query parameter: name' },
        { status: 400 }
      );
    }
    
    const deleted = await PersonModel.delete(name);
    
    if (!deleted) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting person:', error);
    return NextResponse.json({ error: 'Failed to delete person' }, { status: 500 });
  }
}
