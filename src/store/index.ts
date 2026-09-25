import { configureStore } from '@reduxjs/toolkit';
import { emergencyReducer } from '@modules/emergency/store/emergency.reducer';
export const makeStore = () => configureStore({ reducer: { emergency: emergencyReducer } });
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
