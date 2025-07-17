export const getRecipientUser = (chat, currentUser) => {
    if (!chat?.members || !currentUser) {
        return null;
    }
    return chat.members.find((member) => member.id !== currentUser.id);
};