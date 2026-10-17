import { createContext, useContext } from 'react'

export const NotificationSoundContext = createContext({
    playNotificationSound: () => { console.warn('NotificationSoundContext not provided') },
    isSoundActive: true,
    toggleSound: () => { }
})

export const useNotificationSoundContext = () => useContext(NotificationSoundContext)
