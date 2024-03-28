git reset HEAD~1
rm ./backport.sh
git cherry-pick 3522a5ccf240664f51c8f958f4a80740bbec261d
echo 'Resolve conflicts and force push this branch'
