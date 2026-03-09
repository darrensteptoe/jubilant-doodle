Restore current worktree:
1. git checkout $(cat base_head.txt)
2. git apply --reject --whitespace=nowarn working_tree.patch
3. if untracked_files.tgz exists: tar -xzf untracked_files.tgz
