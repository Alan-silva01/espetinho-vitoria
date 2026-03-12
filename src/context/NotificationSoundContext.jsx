import { createContext, useContext } from 'react'

export const NotificationSoundContext = createContext({
    playNotificationSound: () => { console.warn('NotificationSoundContext not provided') }
})

export const useNotificationSoundContext = () => useContext(NotificationSoundContext)
