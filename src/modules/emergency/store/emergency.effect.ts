import { createAsyncThunk } from '@reduxjs/toolkit';
import type { SearchLocation } from '@shared/models/emergency.model';
import { findNearby } from '@shared/services/emergency.service';
export const loadNearby = createAsyncThunk('emergency/loadNearby', async ({ location, radius }: { location: SearchLocation; radius: number }, { signal }) => findNearby(location, radius, signal));
