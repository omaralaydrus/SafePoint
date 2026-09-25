import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { DEFAULT_LOCATION, type CategoryFilter, type EmergencyPlace, type SearchLocation } from '@shared/models/emergency.model';
import { loadNearby } from './emergency.effect';
interface EmergencyState {
  location: SearchLocation; radius: number; category: CategoryFilter; places: EmergencyPlace[];
  status: 'idle' | 'loading' | 'ready' | 'error'; error: string | null; requestId?: string; fetchedAt?: string;
}
const initialState: EmergencyState = { location: DEFAULT_LOCATION, radius: 5, category: 'all', places: [], status: 'idle', error: null };
const slice = createSlice({ name: 'emergency', initialState,
  reducers: {
    setLocation(state, action: PayloadAction<SearchLocation>) { state.location = action.payload; state.places = []; state.requestId = undefined; state.status = 'idle'; },
    setRadius(state, action: PayloadAction<number>) { state.radius = action.payload; state.places = []; state.requestId = undefined; state.status = 'idle'; },
    setCategory(state, action: PayloadAction<CategoryFilter>) { state.category = action.payload; },
  },
  extraReducers: builder => builder
    .addCase(loadNearby.pending, (state, action) => { state.requestId = action.meta.requestId; state.status = 'loading'; state.error = null; state.places = []; })
    .addCase(loadNearby.fulfilled, (state, action) => {
      if (state.requestId !== action.meta.requestId) return;
      state.places = action.payload.places; state.fetchedAt = action.payload.fetchedAt; state.status = 'ready';
    })
    .addCase(loadNearby.rejected, (state, action) => {
      if (state.requestId !== action.meta.requestId || action.meta.aborted) return;
      state.status = 'error'; state.error = action.error.message || 'Could not load nearby places.';
    }),
});
export const { setLocation, setRadius, setCategory } = slice.actions;
export const emergencyReducer = slice.reducer;
