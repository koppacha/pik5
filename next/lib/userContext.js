import {createContext, useContext, useState} from "react";

const UserContext = createContext()

export function useUser(){
    return useContext(UserContext)
}

export async function UserProvider({children}) {
    const [user, setUser] = useState(null)

    const users = ""

    setUser(users)

    return (
        <UserContext.Provider value={{user, setUser}}>
            {children}
        </UserContext.Provider>
    )
}