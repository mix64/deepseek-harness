# Write outside the workspace

English | [中文](additional-directories.zh.md)

## Summary

Under **Workspace Write**, a session changes files only inside its workspace. Add more directories to the session when a task must also change files elsewhere, such as a sibling repository or a shared library checkout. Each session keeps its own list.

## Add a directory

1. Select **Workspace Write** in the composer's permission selector. Other modes keep the list but grant nothing, and the directories control says **Not writable in the current mode**.
2. Open **Add directory** beside the permission selector. After the first directory it reads **Directories (n)**.
3. Choose **Add directory…** and pick a folder, or choose a registered Workspace under **Workspaces** to add it in one click.

The directory appears below the main workspace in the menu, and the conversation records the `/add-dir` command. On Windows, granting access to a large folder can take several seconds; the control shows **Granting access…** until it finishes.

## Use slash commands

Type `/add-dir <dir>` to add a directory, `/remove-dir <dir>` to remove one, and `/add-dir` alone to list them. A path with spaces works as typed; a path that starts with `"` must be one JSON string, such as `/add-dir "D:\\shared lib"`. A relative path is resolved against the workspace.

## What cannot be added

A directory is refused, with the reason shown beside the control, when it:

- is a filesystem root;
- is the workspace, lies inside it, or contains it;
- overlaps a directory already added;
- is a temporary directory or contains one, such as your Windows user profile directory;
- would exceed the session's limit of 16 directories, which the deployment can change.

## New sessions and subagents

A New Session in the same workspace starts with the current session's directories. A notice names any directory that could not be carried over, for example because it no longer exists. Subagents and forks start with their parent's directories; a session in another workspace starts with none.

## Remove a directory

Open the menu and choose the directory's row, or type `/remove-dir <dir>`. The folder's files are untouched. On Windows the folder keeps the access entry DSH added, which later sessions no longer use; the [Windows ACL reference](../../../packages/sandbox/sandbox-windows-acl/README.md#known-limitations-and-deferred-work) describes that residue.
