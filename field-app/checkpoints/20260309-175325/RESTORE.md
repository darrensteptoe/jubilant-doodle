Checkpoint restore guide

Base commit:
- see base_head.txt

To restore tracked file changes from this checkpoint:
1) git apply --index "$cpdir/working_tree.patch"

To restore untracked files from this checkpoint:
2) tar -xzf "$cpdir/untracked_files.tgz"

Verification:
3) git status --short
