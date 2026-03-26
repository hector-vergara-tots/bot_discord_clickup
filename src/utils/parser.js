/**
 * Maps a Discord user mention/username to a ClickUp member.
 * @param {string} discordUsername - The Discord username (without @)
 * @param {Array} clickupMembers - Array of ClickUp workspace members
 * @returns {number|null} ClickUp user ID or null if not found
 */
function resolveClickUpAssignee(discordUsername, clickupMembers) {
  if (!discordUsername || !clickupMembers?.length) return null;

  const normalized = discordUsername.toLowerCase().trim();

  const member = clickupMembers.find((m) => {
    const email = (m.email || '').toLowerCase();
    const username = (m.username || '').toLowerCase();
    const fullName = (m.profileInfo?.display_name || m.username || '').toLowerCase();

    return (
      username === normalized ||
      email.startsWith(normalized) ||
      fullName === normalized ||
      fullName.replace(/\s+/g, '') === normalized.replace(/\s+/g, '')
    );
  });

  return member ? member.id : null;
}

module.exports = { resolveClickUpAssignee };
