#!/bin/sh
# if the provisioning.lock file exists do not provision
{
if [ ! -f /vagrant/provision.lock ]; then

  # add nodejs repository
  apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv C7917B12
  echo 'deb http://ppa.launchpad.net/chris-lea/node.js/ubuntu precise main' | tee /etc/apt/sources.list.d/chris-lea-node_js-precise.list 
  echo 'deb-src http://ppa.launchpad.net/chris-lea/node.js/ubuntu precise main' | tee -a /etc/apt/sources.list.d/chris-lea-node_js-precise.list 
  
  # add mongodb repository
  apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
  echo 'deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen' | tee /etc/apt/sources.list.d/mongodb.list

  # add nginx repository
  apt-key adv --keyserver keyserver.ubuntu.com --recv-keys C300EE8C
  echo "deb http://ppa.launchpad.net/nginx/stable/ubuntu lucid main" | tee /etc/apt/sources.list.d/nginx-stable-lucid.list

  # update ubuntu pacakges
  apt-get -y update

  # install packages
  apt-get -y install python-software-properties python g++ make mongodb-10gen nodejs git nginx

  # create the provisioning lock file
  touch /vagrant/provision.lock

fi
}