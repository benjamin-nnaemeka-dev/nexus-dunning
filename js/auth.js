async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession()
    if (!session) {
        window.location.href = 'login.html'
        return null
    }
    return session
}

async function signOut() {
    await supabaseClient.auth.signOut()
    window.location.href = 'login.html'
}
